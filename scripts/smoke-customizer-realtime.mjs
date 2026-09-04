import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const productionUrl = process.env.ABAGS_PRODUCTION_URL || "https://abagshandmade.pl";
const outputDir = process.env.ABAGS_REALTIME_QA_DIR || "";
const port = Number(process.env.ABAGS_REALTIME_CHROME_DEBUG_PORT || 9777);
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

async function main() {
  const binary = chromeBinary();
  const url = `${productionUrl}${productionUrl.includes("?") ? "&" : "?"}abags-realtime-builder-qa=${Date.now()}`;
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
    const waitFor = async (expression, label, deadlineMs = timeoutMs) => {
      const deadline = Date.now() + deadlineMs;
      let value;
      while (Date.now() < deadline) {
        value = await evaluate(expression);
        if (value) return value;
        await sleep(150);
      }
      throw new Error(`Timed out waiting for ${label}. Last value: ${JSON.stringify(value)}`);
    };
    const capture = async (name) => {
      const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
      if (outputDir) {
        mkdirSync(outputDir, { recursive: true });
        writeFileSync(join(outputDir, name), Buffer.from(shot.data, "base64"));
      }
      return shot.data.length;
    };
    const clearDraftAndReload = async () => {
      await evaluate(`(() => { try { localStorage.removeItem('abags-bag-builder-v3'); localStorage.removeItem('abags-photo-true-v1'); } catch {} return true; })()`);
      await send("Page.reload", { ignoreCache: true });
      await waitFor("document.readyState === 'complete'", "document reload");
    };
    const openBuilder = async () => {
      await waitFor("Boolean(document.querySelector('#personalizacja'))", "personalization entry");
      const opened = await evaluate(`(() => { const b=[...document.querySelectorAll('button')].find((n)=>n.textContent?.includes('Uruchom konfigurator')); if(!b)return false; b.click(); return true; })()`);
      if (!opened) throw new Error("Could not open the realtime customizer.");
      await waitFor("Boolean(document.querySelector('.abags-vc-dialog.abags-reference-layout-v4'))", "realtime builder dialog");
      await waitFor("Boolean(document.querySelector('.abags-bag-builder-stage'))", "realtime construction stage");
    };
    const stageState = async () => evaluate(`(() => {
      const d=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4');
      const s=d?.querySelector('.abags-bag-builder-stage');
      if(!d||!s)return null;
      const svg=s.querySelector(':scope > svg');
      const canvas=s.querySelector('canvas');
      const style=getComputedStyle(d);
      const rect=d.getBoundingClientRect();
      return {
        family:s.dataset.family||'', color:s.dataset.color||'', stitch:s.dataset.stitch||'',
        signature:s.dataset.builderSignature||'',
        photoTrue:Boolean(d.querySelector('.abags-photo-true-base')) || d.dataset.abagsPhotoTrue==='active' || s.dataset.abagsPhotoTrue==='active',
        readyProductChoices:d.querySelectorAll('[data-photo-product-choice]').length,
        svgPresent:Boolean(svg), canvasPresent:Boolean(canvas),
        dialogWidth:Math.round(rect.width), dialogHeight:Math.round(rect.height),
        dialogTop:Math.round(rect.top), dialogLeft:Math.round(rect.left),
        dialogVisible:style.display!=='none' && style.visibility!=='hidden' && rect.width>1 && rect.height>1,
      };
    })()`);
    const choose = async (key, value) => {
      const clicked = await evaluate(`(() => {
        const b=[...document.querySelectorAll('button[data-builder-key=${JSON.stringify(key)}]')].find((n)=>n.dataset.builderValue===${JSON.stringify(value)});
        if(!b || b.disabled)return false; b.click(); return true;
      })()`);
      if (!clicked) throw new Error(`Could not select ${key}=${value}.`);
      await waitFor(`document.querySelector('.abags-bag-builder-stage')?.dataset[${JSON.stringify(key)}]===${JSON.stringify(value)}`, `${key}=${value}`);
    };
    const assertCustomerMode = (state, label) => {
      if (!state?.dialogVisible || state.photoTrue || state.readyProductChoices !== 0 || (!state.svgPresent && !state.canvasPresent)) {
        throw new Error(`${label} is not the customer realtime builder: ${JSON.stringify(state)}`);
      }
    };
    const buildBag = async ({ family, color, stitch }, label) => {
      const empty = await stageState();
      assertCustomerMode(empty, `${label} initial`);
      if (empty.family || empty.color || empty.stitch) throw new Error(`${label} did not start from an empty construction: ${JSON.stringify(empty)}`);
      const initialSignature = empty.signature;

      await choose("family", family);
      const afterFamily = await stageState();
      assertCustomerMode(afterFamily, `${label} after family`);
      if (afterFamily.signature === initialSignature) throw new Error(`${label} family selection did not update the live preview signature.`);

      await choose("color", color);
      const afterColor = await stageState();
      assertCustomerMode(afterColor, `${label} after color`);
      if (afterColor.signature === afterFamily.signature || afterColor.color.toUpperCase() !== color.toUpperCase()) throw new Error(`${label} color selection did not update the live preview.`);

      await choose("stitch", stitch);
      const afterStitch = await stageState();
      assertCustomerMode(afterStitch, `${label} after stitch`);
      if (afterStitch.signature === afterColor.signature || afterStitch.stitch !== stitch) throw new Error(`${label} stitch selection did not update the live preview.`);
      return afterStitch;
    };

    await send("Runtime.enable");
    await send("Page.enable");

    await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await waitFor("document.readyState === 'complete'", "desktop initial load");
    await clearDraftAndReload();
    await openBuilder();
    const desktop = await buildBag({ family: "tote", color: "#E4A9B5", stitch: "herringbone" }, "Desktop");
    const desktopBytes = await capture("customizer-desktop-realtime.png");

    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await clearDraftAndReload();
    await openBuilder();
    const mobile = await buildBag({ family: "mini", color: "#087E81", stitch: "basket" }, "Mobile");
    if (mobile.dialogWidth > 390 || mobile.dialogLeft < -1 || mobile.dialogTop < -1) throw new Error(`Mobile builder escaped the viewport: ${JSON.stringify(mobile)}`);
    const socialsVisible = await evaluate(`[...document.querySelectorAll('.social-quick-links')].some((n)=>{const s=getComputedStyle(n),r=n.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>1&&r.height>1;})`);
    if (socialsVisible) throw new Error("Floating storefront social links are visible over the mobile builder.");
    const mobileBytes = await capture("customizer-mobile-realtime.png");

    console.log("REALTIME BUILDER PASS:", productionUrl);
    console.log("- starts from empty construction: yes");
    console.log("- finished-product Photo-True takeover: absent");
    console.log("- family/color/stitch update live signature: yes");
    console.log(`- desktop screenshot bytes: ${desktopBytes}`);
    console.log(`- mobile screenshot bytes: ${mobileBytes}`);
    console.log(`- desktop final: ${desktop.family} / ${desktop.color} / ${desktop.stitch}`);
    console.log(`- mobile final: ${mobile.family} / ${mobile.color} / ${mobile.stitch}`);
  } finally {
    try { socket?.close(); } catch {}
    chrome.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error("Realtime builder production acceptance failed:", error);
  process.exitCode = 1;
});
