import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";

const productionUrl = process.env.ABAGS_PRODUCTION_URL || "https://abagshandmade.pl";
const port = Number(process.env.ABAGS_PRO3D_CHROME_DEBUG_PORT || 9333);
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
    const timer = setTimeout(() => {
      pending.delete(messageId);
      reject(new Error(`CDP command timed out: ${method}`));
    }, cdpTimeoutMs);
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
  const url = `${productionUrl}${productionUrl.includes("?") ? "&" : "?"}abags-pro3d-smoke=${Date.now()}`;
  const chrome = spawn(binary, [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-background-networking",
    "--disable-default-apps",
    "--no-first-run",
    `--remote-debugging-port=${port}`,
    "about:blank",
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

    await send("Runtime.enable");
    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await waitFor("document.readyState === 'complete'", "document load");
    await waitFor("Boolean(document.querySelector('#personalizacja'))", "personalization entry");

    await evaluate(`(() => { const b=[...document.querySelectorAll('button')].find((n)=>n.textContent?.includes('Uruchom konfigurator')); b?.click(); return Boolean(b); })()`);
    await waitFor("Boolean(document.querySelector('.abags-bag-builder-stage'))", "bag builder stage");

    const choose = async (key, val) => {
      const ok = await evaluate(`(() => { const b=document.querySelector('[data-builder-key=${JSON.stringify(key)}][data-builder-value=${JSON.stringify(val)}]'); if(!b)return false; b.click(); return true; })()`);
      if (!ok) throw new Error(`Missing builder choice ${key}=${val}.`);
      await sleep(120);
    };
    await choose("family", "round");
    await choose("color", "#222124");
    await choose("stitch", "herringbone");
    await choose("flap", "leather-black");
    await choose("handles", "crochet");
    await choose("strap", "leather");

    await waitFor("document.querySelector('.abags-bag-builder-stage')?.getAttribute('data-abags-pro3d-ready') === 'true'", "WebGL Pro3D readiness");
    await waitFor("Boolean(document.querySelector('.abags-pro3d-canvas'))", "Pro3D canvas");

    const screenshotHash = async () => digest((await send("Page.captureScreenshot", { format: "png", fromSurface: true })).data);
    const rect = async (selector, text = "") => evaluate(`(() => { const nodes=[...document.querySelectorAll(${JSON.stringify(selector)})]; const el=${text ? `nodes.find((n)=>n.textContent?.trim()===${JSON.stringify(text)})` : "nodes[0]"}; if(!el)return null; const r=el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height}; })()`);
    const tap = async (point) => {
      if (!point) throw new Error("Touch target not found.");
      await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: point.x, y: point.y, radiusX: 4, radiusY: 4, force: 1, id: 1 }] });
      await sleep(70);
      await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await sleep(240);
    };

    const beforeView = await screenshotHash();
    await tap(await rect(".abags-pro3d-view-controls button", "Bok"));
    const afterSide = await screenshotHash();
    if (afterSide === beforeView) throw new Error("Touching 'Bok' did not visibly rotate the 3D model.");

    const beforeZoom = afterSide;
    const plus = await rect('.abags-pro3d-zoom button[aria-label="Przybliż model"]');
    await tap(plus);
    const afterZoom = await screenshotHash();
    if (afterZoom === beforeZoom) throw new Error("Touching '+' did not visibly zoom the 3D model.");

    const canvas = await rect(".abags-pro3d-canvas");
    if (!canvas) throw new Error("Canvas bounds unavailable.");
    const beforeDrag = afterZoom;
    const sx = canvas.x - Math.min(canvas.w * 0.18, 55);
    const sy = canvas.y;
    const ex = canvas.x + Math.min(canvas.w * 0.2, 65);
    await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: sx, y: sy, radiusX: 5, radiusY: 5, force: 1, id: 7 }] });
    for (let i = 1; i <= 5; i += 1) {
      await send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: sx + ((ex - sx) * i) / 5, y: sy + i, radiusX: 5, radiusY: 5, force: 1, id: 7 }] });
      await sleep(45);
    }
    await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await sleep(280);
    const afterDrag = await screenshotHash();
    if (afterDrag === beforeDrag) throw new Error("Dragging one finger did not visibly rotate the 3D model.");

    console.log("Mobile Pro3D touch controls passed:", JSON.stringify({ sideChanged: true, zoomChanged: true, dragChanged: true }));
  } finally {
    try { socket?.close(); } catch {}
    chrome.kill("SIGTERM");
    await sleep(250);
    if (chrome.exitCode === null) chrome.kill("SIGKILL");
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(`Mobile Pro3D smoke failed: ${error instanceof Error ? error.stack || error.message : String(error)}`);
  process.exit(1);
});
