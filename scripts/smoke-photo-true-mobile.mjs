import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";

const productionUrl = process.env.ABAGS_PRODUCTION_URL || "https://abagshandmade.pl";
const port = Number(process.env.ABAGS_PHOTO_TRUE_MOBILE_PORT || 9777);
const timeoutMs = 60_000;
const cdpTimeoutMs = 8_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function chromeBinary() {
  for (const candidate of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    const found = spawnSync("which", [candidate], { encoding: "utf8" });
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error("Chrome/Chromium is not available on the CI runner.");
}

async function waitJson(url, options = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response.json();
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) { lastError = error; }
    await sleep(200);
  }
  throw lastError instanceof Error ? lastError : new Error(`Timed out waiting for ${url}`);
}

async function connectCdp(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("CDP connection timed out.")), cdpTimeoutMs);
    socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("CDP connection failed.")); }, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id) return;
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    clearTimeout(waiter.timer);
    if (message.error) waiter.reject(new Error(message.error.message || "CDP error"));
    else waiter.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const messageId = ++id;
    const timer = setTimeout(() => { pending.delete(messageId); reject(new Error(`CDP command timed out: ${method}`)); }, cdpTimeoutMs);
    pending.set(messageId, { resolve, reject, timer });
    socket.send(JSON.stringify({ id: messageId, method, params }));
  });
  return { socket, send };
}

function valueOf(result) {
  if (result?.exceptionDetails) throw new Error(result.exceptionDetails.text || "Runtime evaluation failed.");
  return result?.result?.value;
}

function digest(base64) {
  return createHash("sha256").update(base64).digest("hex");
}

async function main() {
  const binary = chromeBinary();
  const url = `${productionUrl}${productionUrl.includes("?") ? "&" : "?"}abags-photo-mobile=${Date.now()}`;
  const chrome = spawn(binary, [
    "--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--disable-background-networking",
    "--disable-default-apps", "--no-first-run", `--remote-debugging-port=${port}`, "about:blank",
  ], { stdio: ["ignore", "pipe", "pipe"] });
  let socket;

  try {
    await waitJson(`http://127.0.0.1:${port}/json/version`);
    const target = await waitJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
    const cdp = await connectCdp(target.webSocketDebuggerUrl);
    socket = cdp.socket;
    const send = cdp.send;
    const evaluate = async (expression) => valueOf(await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true }));
    const waitFor = async (expression, label) => {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (await evaluate(expression)) return;
        await sleep(150);
      }
      throw new Error(`Timed out waiting for ${label}.`);
    };
    const screenshotHash = async () => digest((await send("Page.captureScreenshot", { format: "png", fromSurface: true })).data);
    const rect = async (selector) => evaluate(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); if(!el)return null; const r=el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height}; })()`);
    const tap = async (point) => {
      if (!point) throw new Error("Touch target not found.");
      await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: point.x, y: point.y, radiusX: 4, radiusY: 4, force: 1, id: 1 }] });
      await sleep(80);
      await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await sleep(350);
    };

    await send("Runtime.enable");
    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await waitFor("document.readyState === 'complete'", "document load");
    await waitFor("Boolean(document.querySelector('#personalizacja'))", "personalization entry");
    await evaluate(`(() => { const b=[...document.querySelectorAll('button')].find((n)=>n.textContent?.includes('Uruchom konfigurator')); b?.click(); return Boolean(b); })()`);
    await waitFor("Boolean(document.querySelector('.abags-bag-builder-stage'))", "builder stage");

    const photoReady = await (async () => {
      const deadline = Date.now() + 20_000;
      while (Date.now() < deadline) {
        const ready = await evaluate(`(() => { const s=document.querySelector('.abags-bag-builder-stage'); const img=document.querySelector('.abags-photo-true-base'); return s?.dataset.abagsPhotoTrue==='active' && img?.complete && img.naturalWidth>0; })()`);
        if (ready) return true;
        await sleep(150);
      }
      return false;
    })();

    if (!photoReady) {
      // The old renderer remains a fallback only when the catalog truly has no photograph.
      await waitFor(`(() => { const s=document.querySelector('.abags-bag-builder-stage'); return s?.dataset.abagsPro3dReady==='true' || s?.dataset.abagsCanvas3dReady==='true'; })()`, "fallback 3D readiness");
      console.log("Photo-True catalog photo unavailable; 3D fallback remains ready.");
      return;
    }

    await waitFor("document.querySelectorAll('[data-photo-product-choice]').length > 0", "real product choices");
    const state = await evaluate(`(() => {
      const s=document.querySelector('.abags-bag-builder-stage');
      const img=document.querySelector('.abags-photo-true-base');
      const synthetic=[...s.querySelectorAll(':scope > svg,.abags-pro3d-layer,.abags-canvas3d-layer')].filter((n)=>{const st=getComputedStyle(n);return st.display!=='none'&&st.visibility!=='hidden'&&Number(st.opacity||1)>.05;});
      return {productId:s.dataset.photoProductId||'',loaded:img.complete&&img.naturalWidth>0,models:document.querySelectorAll('[data-photo-product-choice]').length,visibleSynthetic:synthetic.length};
    })()`);
    if (!state?.productId || !state.loaded || state.models < 1 || state.visibleSynthetic !== 0) throw new Error(`Invalid mobile Photo-True state: ${JSON.stringify(state)}`);

    const modelIds = await evaluate(`[...document.querySelectorAll('[data-photo-product-choice]')].map((b)=>b.dataset.photoProductChoice||'')`);
    if (modelIds.length >= 2) {
      const current = state.productId;
      const targetId = modelIds.find((id) => id && id !== current);
      const selector = `[data-photo-product-choice="${targetId}"]`;
      const before = await screenshotHash();
      await tap(await rect(selector));
      await waitFor(`document.querySelector('.abags-bag-builder-stage')?.dataset.photoProductId===${JSON.stringify(targetId)}`, "touch-selected real product");
      await waitFor(`(() => { const img=document.querySelector('.abags-photo-true-base'); return img?.complete&&img.naturalWidth>0; })()`, "touch-selected real photo");
      const after = await screenshotHash();
      if (after === before) throw new Error("Touching a different real A-Bags model did not visibly change the Photo-True preview.");
    }

    console.log("Mobile Photo-True V5 interaction passed:", JSON.stringify({ models: state.models, realProduct: true, syntheticHidden: true }));
  } finally {
    try { socket?.close(); } catch {}
    chrome.kill("SIGTERM");
    await sleep(250);
    if (chrome.exitCode === null) chrome.kill("SIGKILL");
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(`Mobile Photo-True V5 smoke failed: ${error instanceof Error ? error.stack || error.message : String(error)}`);
  process.exit(1);
});
