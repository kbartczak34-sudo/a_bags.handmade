import { spawn, spawnSync } from "node:child_process";

const productionUrl = process.env.ABAGS_PRODUCTION_URL || "https://abagshandmade.pl";
const port = Number(process.env.ABAGS_CHROME_DEBUG_PORT || 9222);
const timeoutMs = 30_000;
const renderTimeoutMs = 10_000;
const cdpTimeoutMs = 7_000;
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
    await sleep(250);
  }
  throw lastError instanceof Error ? lastError : new Error(`Timed out waiting for ${url}`);
}

async function connectCdp(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("CDP WebSocket connection timed out.")), cdpTimeoutMs);
    socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("CDP WebSocket connection failed.")); }, { once: true });
  });
  let id = 0;
  const pending = new Map();
  const rejectPending = (reason) => {
    for (const waiter of pending.values()) {
      clearTimeout(waiter.timer);
      waiter.reject(reason);
    }
    pending.clear();
  };
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id) return;
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    clearTimeout(waiter.timer);
    if (message.error) waiter.reject(new Error(`${message.error.message ?? "CDP error"}`));
    else waiter.resolve(message.result);
  });
  socket.addEventListener("close", () => rejectPending(new Error("CDP WebSocket closed before the command completed.")));
  socket.addEventListener("error", () => rejectPending(new Error("CDP WebSocket failed while a command was pending.")));
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

function resultValue(result) {
  if (result?.exceptionDetails) throw new Error(result.exceptionDetails.text || "Runtime evaluation failed.");
  return result?.result?.value;
}

async function main() {
  const binary = chromeBinary();
  const chrome = spawn(binary, ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--disable-background-networking", "--disable-default-apps", "--no-first-run", `--remote-debugging-port=${port}`, "about:blank"], { stdio: ["ignore", "pipe", "pipe"] });
  let chromeLog = "";
  let socket;
  chrome.stderr.on("data", (chunk) => { chromeLog += String(chunk); });

  try {
    await waitJson(`http://127.0.0.1:${port}/json/version`);
    const target = await waitJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(productionUrl)}`, { method: "PUT" });
    if (!target.webSocketDebuggerUrl) throw new Error("Chrome did not expose a page debugger URL.");
    const cdp = await connectCdp(target.webSocketDebuggerUrl);
    socket = cdp.socket;
    const send = cdp.send;
    const evaluate = async (expression) => resultValue(await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true }));
    const waitFor = async (expression, label, expected = true, deadlineMs = timeoutMs) => {
      const deadline = Date.now() + deadlineMs;
      let value;
      while (Date.now() < deadline) {
        value = await evaluate(expression);
        if (expected === true ? Boolean(value) : value === expected) return value;
        await sleep(150);
      }
      throw new Error(`Timed out waiting for ${label}. Last value: ${JSON.stringify(value)}`);
    };

    await send("Runtime.enable");
    await send("Page.enable");
    await waitFor("document.readyState === 'complete'", "production document load");
    await waitFor("Boolean(document.querySelector('#personalizacja'))", "personalization entry");
    const opened = await evaluate(`(() => { const button=[...document.querySelectorAll('button')].find((node)=>node.textContent?.includes('Uruchom konfigurator')); if(!button)return false; button.click(); return true; })()`);
    if (!opened) throw new Error("Could not find the 'Uruchom konfigurator' button.");

    await waitFor("Boolean(document.querySelector('.abags-vc-dialog'))", "visual customizer dialog");
    await waitFor("Boolean(document.querySelector('[data-abags-exact-live]'))", "bag builder mount");
    await waitFor("Boolean(document.querySelector('.abags-builder-controls'))", "bag builder controls");
    await waitFor("Boolean(document.querySelector('.abags-bag-builder-stage'))", "persistent realtime preview", true, renderTimeoutMs);
    await waitFor("document.querySelector('.abags-vc-header .eyebrow')?.textContent?.includes('Bag Builder 3.0')", "Bag Builder 3.0 header");

    const layoutState = await evaluate(`(() => {
      const previewColumn=document.querySelector('.abags-vc-preview-column');
      const mount=document.querySelector('[data-abags-exact-live]');
      if(!previewColumn||!mount)return null;
      const previewStyle=getComputedStyle(previewColumn);
      const mountStyle=getComputedStyle(mount);
      return {position:previewStyle.position,previewOrder:previewStyle.order,mountOrder:mountStyle.order};
    })()`);
    if (!layoutState || layoutState.position !== "sticky") throw new Error(`Realtime preview is not sticky: ${JSON.stringify(layoutState)}`);

    const initialSignature = await evaluate("document.querySelector('.abags-bag-builder-stage')?.getAttribute('data-builder-signature') || ''");

    const choose = async (key, value) => {
      const clicked = await evaluate(`(() => { const button=document.querySelector('[data-builder-key=${JSON.stringify(key)}][data-builder-value=${JSON.stringify(value)}]'); if(!button)return false; button.click(); return true; })()`);
      if (!clicked) throw new Error(`Could not choose ${key}=${value}.`);
    };

    await choose("family", "tote");
    await waitFor("document.querySelector('.abags-bag-builder-stage')?.getAttribute('data-family') === 'tote'", "bag silhouette appears");
    await waitFor("Boolean(document.querySelector('.abags-bag-builder-stage [data-layer=\"body\"]'))", "body layer appears");

    await choose("color", "#24324D");
    await waitFor("document.querySelector('.abags-bag-builder-stage')?.getAttribute('data-color') === '#24324D'", "yarn color fills silhouette");

    await choose("stitch", "herringbone");
    await waitFor("document.querySelector('.abags-bag-builder-stage')?.getAttribute('data-stitch') === 'herringbone'", "stitch changes in realtime");

    const afterCore = await evaluate("document.querySelector('.abags-bag-builder-stage')?.getAttribute('data-builder-signature') || ''");
    if (!afterCore || afterCore === initialSignature) throw new Error("Core bag construction did not change the realtime preview signature.");

    await choose("handles", "wood-light");
    await waitFor("document.querySelector('.abags-bag-builder-stage')?.getAttribute('data-handles') === 'wood-light'", "wooden handles added");
    await waitFor("Boolean(document.querySelector('.abags-bag-builder-stage [data-layer=\"handles\"]'))", "handle layer appears");

    await choose("strap", "chain");
    await waitFor("document.querySelector('.abags-bag-builder-stage')?.getAttribute('data-strap') === 'chain'", "chain strap added");
    await waitFor("Boolean(document.querySelector('.abags-bag-builder-stage [data-layer=\"strap\"]'))", "strap layer appears");

    await choose("flap", "leather-black");
    await waitFor("Boolean(document.querySelector('.abags-bag-builder-stage [data-layer=\"flap\"]'))", "flap layer appears");

    await choose("accent", "tassel");
    await waitFor("document.querySelector('.abags-bag-builder-stage')?.getAttribute('data-accent') === 'tassel'", "accent added");
    await waitFor("Boolean(document.querySelector('.abags-bag-builder-stage [data-layer=\"accent\"]'))", "accent layer appears");

    await waitFor("getComputedStyle(document.querySelector('.abags-vc-controls')).display === 'none'", "legacy controls hidden");
    await waitFor("Boolean([...document.querySelectorAll('.abags-builder-actions button')].find((node)=>node.textContent?.includes('Zapisz projekt') && !node.disabled))", "save project enabled");
    await waitFor("Boolean([...document.querySelectorAll('.abags-builder-actions a')].find((node)=>node.textContent?.includes('Wyślij projekt do pracowni')))", "workshop handoff control");

    const saved = await evaluate(`(() => { const button=[...document.querySelectorAll('.abags-builder-actions button')].find((node)=>node.textContent?.includes('Zapisz projekt')); if(!button)return false; button.click(); return true; })()`);
    if (!saved) throw new Error("Could not save the Bag Builder project.");
    await waitFor("Boolean([...document.querySelectorAll('.abags-builder-actions button')].find((node)=>node.textContent?.includes('Zapisano')))", "saved project confirmation");

    const result = await evaluate(`(() => ({
      family:document.querySelector('.abags-bag-builder-stage')?.getAttribute('data-family')||'',
      color:document.querySelector('.abags-bag-builder-stage')?.getAttribute('data-color')||'',
      stitch:document.querySelector('.abags-bag-builder-stage')?.getAttribute('data-stitch')||'',
      handles:document.querySelector('.abags-bag-builder-stage')?.getAttribute('data-handles')||'',
      strap:document.querySelector('.abags-bag-builder-stage')?.getAttribute('data-strap')||'',
      flap:Boolean(document.querySelector('.abags-bag-builder-stage [data-layer="flap"]')),
      accent:Boolean(document.querySelector('.abags-bag-builder-stage [data-layer="accent"]')),
      previewPosition:getComputedStyle(document.querySelector('.abags-vc-preview-column')).position,
      legacyControlsHidden:getComputedStyle(document.querySelector('.abags-vc-controls')).display==='none',
      workshopLink:Boolean(document.querySelector('.abags-builder-actions a[href]'))
    }))()`);
    console.log("Realtime layered Bag Builder browser smoke passed:", JSON.stringify(result));
  } finally {
    try { socket?.close(); } catch {}
    chrome.kill("SIGTERM");
    await sleep(250);
    if (chrome.exitCode === null) chrome.kill("SIGKILL");
    if (process.env.ABAGS_DEBUG_CHROME === "1" && chromeLog) console.error(chromeLog);
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(`Realtime layered Bag Builder browser smoke failed: ${error instanceof Error ? error.stack || error.message : String(error)}`);
  process.exit(1);
});
