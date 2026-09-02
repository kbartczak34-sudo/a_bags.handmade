import { spawn, spawnSync } from "node:child_process";

const productionUrl = process.env.ABAGS_PRODUCTION_URL || "https://abagshandmade.pl";
const port = Number(process.env.ABAGS_CHROME_DEBUG_PORT || 9222);
const timeoutMs = 30_000;
const renderTimeoutMs = 10_000;
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
    const timer = setTimeout(() => reject(new Error("CDP WebSocket connection timed out.")), 10_000);
    socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("CDP WebSocket connection failed.")); }, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id) return;
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(`${message.error.message ?? "CDP error"}`));
    else waiter.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const messageId = ++id;
    pending.set(messageId, { resolve, reject });
    socket.send(JSON.stringify({ id: messageId, method, params }));
  });
  return { socket, send };
}

function resultValue(result) { return result?.result?.value; }

async function main() {
  const binary = chromeBinary();
  const chrome = spawn(binary, ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--disable-background-networking", "--disable-default-apps", "--no-first-run", `--remote-debugging-port=${port}`, "about:blank"], { stdio: ["ignore", "pipe", "pipe"] });
  let chromeLog = "";
  chrome.stderr.on("data", (chunk) => { chromeLog += String(chunk); });

  try {
    await waitJson(`http://127.0.0.1:${port}/json/version`);
    const target = await waitJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(productionUrl)}`, { method: "PUT" });
    if (!target.webSocketDebuggerUrl) throw new Error("Chrome did not expose a page debugger URL.");
    const { socket, send } = await connectCdp(target.webSocketDebuggerUrl);
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

    await send("Runtime.enable"); await send("Page.enable");
    await waitFor("document.readyState === 'complete'", "production document load");
    await waitFor("Boolean(document.querySelector('#personalizacja'))", "personalization entry");
    const opened = await evaluate(`(() => { const button=[...document.querySelectorAll('button')].find((node)=>node.textContent?.includes('Uruchom konfigurator')); if(!button)return false; button.click(); return true; })()`);
    if (!opened) throw new Error("Could not find the 'Uruchom konfigurator' button.");

    await waitFor("Boolean(document.querySelector('.abags-vc-dialog'))", "visual customizer dialog");
    await waitFor("Boolean(document.querySelector('[data-abags-exact-live]'))", "exact live customizer mount");
    await waitFor("Boolean(document.querySelector('.abags-exact-live'))", "exact live customizer UI");
    await waitFor("document.querySelectorAll('.abags-exact-live-fields select').length === 8", "eight personalization selectors");
    await waitFor("Boolean(document.querySelector('.abags-vc-exact-sprite'))", "photographic exact preview", true, renderTimeoutMs);
    await waitFor("Boolean(document.querySelector('.abags-vc-exact-reference-badge')?.textContent?.includes('Podgląd 1:1'))", "exact preview badge");

    const initialReference = await evaluate("document.querySelector('.abags-vc-exact-sprite')?.getAttribute('data-exact-reference-id') || ''");
    if (!initialReference) throw new Error("Exact preview does not expose an active photographed reference.");

    const layoutState = await evaluate(`(() => {
      const previewColumn=document.querySelector('.abags-vc-preview-column');
      const mount=document.querySelector('[data-abags-exact-live]');
      if(!previewColumn||!mount)return null;
      const previewStyle=getComputedStyle(previewColumn);
      const mountStyle=getComputedStyle(mount);
      return {position:previewStyle.position,previewOrder:previewStyle.order,mountOrder:mountStyle.order};
    })()`);
    if (!layoutState || layoutState.position !== "sticky") throw new Error(`Realtime preview is not sticky in the responsive browser layout: ${JSON.stringify(layoutState)}`);

    const switched = await evaluate(`(() => {
      const buttons=[...document.querySelectorAll('.abags-exact-live-variants button')];
      const alternate=buttons.find((button)=>!button.classList.contains('is-active'));
      if(!alternate)return false;
      alternate.click();
      return true;
    })()`);
    if (!switched) throw new Error("No alternate photographed handbag variant was available for browser smoke.");

    await waitFor(`document.querySelector('.abags-vc-exact-sprite')?.getAttribute('data-exact-reference-id') && document.querySelector('.abags-vc-exact-sprite')?.getAttribute('data-exact-reference-id') !== ${JSON.stringify(initialReference)}`, "real-time photographic preview update", true, renderTimeoutMs);

    const afterReference = await evaluate("document.querySelector('.abags-vc-exact-sprite')?.getAttribute('data-exact-reference-id') || ''");
    if (!afterReference || afterReference === initialReference) throw new Error("Changing personalization did not change the photographed preview.");

    await waitFor("getComputedStyle(document.querySelector('.abags-vc-controls')).display === 'none'", "synthetic legacy controls hidden");
    await waitFor("Boolean([...document.querySelectorAll('.abags-exact-live-actions button')].find((node)=>node.textContent?.includes('Zapisz projekt')))", "save project control");
    await waitFor("Boolean([...document.querySelectorAll('.abags-vc-exact-reference-toggle')].find((node)=>node.textContent?.includes('Porównaj z modelem bazowym')))", "compare with base control");
    await waitFor("Boolean([...document.querySelectorAll('.abags-exact-live-actions a')].find((node)=>node.textContent?.includes('Wyślij projekt do pracowni')))", "workshop handoff control");

    const compared = await evaluate(`(() => { const button=document.querySelector('.abags-vc-exact-reference-toggle'); if(!button)return false; button.click(); return true; })()`);
    if (!compared) throw new Error("Could not compare project with base model.");
    await waitFor("!document.querySelector('.abags-vc-preview')?.classList.contains('has-exact-reference')", "base comparison state");
    await evaluate(`document.querySelector('.abags-vc-exact-reference-toggle')?.click()`);
    await waitFor("document.querySelector('.abags-vc-preview')?.classList.contains('has-exact-reference')", "return to exact project preview");

    const result = await evaluate(`(() => ({
      selectors:document.querySelectorAll('.abags-exact-live-fields select').length,
      reference:document.querySelector('.abags-vc-exact-sprite')?.getAttribute('data-exact-reference-id')||'',
      badge:document.querySelector('.abags-vc-exact-reference-badge')?.textContent||'',
      variants:document.querySelectorAll('.abags-exact-live-variants button').length,
      previewPosition:getComputedStyle(document.querySelector('.abags-vc-preview-column')).position,
      legacyControlsHidden:getComputedStyle(document.querySelector('.abags-vc-controls')).display==='none',
      workshopLink:Boolean(document.querySelector('.abags-exact-live-actions a[href]'))
    }))()`);
    console.log("Exact realtime photographic customizer browser smoke passed:", JSON.stringify(result));
    socket.close();
  } finally {
    chrome.kill("SIGTERM"); await sleep(200); if (!chrome.killed) chrome.kill("SIGKILL"); if (process.env.ABAGS_DEBUG_CHROME === "1" && chromeLog) console.error(chromeLog);
  }
}

main().catch((error) => { console.error(`Exact realtime photographic customizer browser smoke failed: ${error instanceof Error ? error.stack || error.message : String(error)}`); process.exitCode = 1; });
