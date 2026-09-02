import { spawn, spawnSync } from "node:child_process";

const productionUrl = process.env.ABAGS_PRODUCTION_URL || "https://abagshandmade.pl";
const port = Number(process.env.ABAGS_CHROME_DEBUG_PORT || 9222);
const timeoutMs = 30_000;
const renderTimeoutMs = 5_000;
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
    const waitFor = async (expression, label, expected = true) => {
      const deadline = Date.now() + timeoutMs;
      let value;
      while (Date.now() < deadline) {
        value = await evaluate(expression);
        if (expected === true ? Boolean(value) : value === expected) return value;
        await sleep(200);
      }
      throw new Error(`Timed out waiting for ${label}. Last value: ${JSON.stringify(value)}`);
    };

    await send("Runtime.enable"); await send("Page.enable");
    await waitFor("document.readyState === 'complete'", "production document load");
    await waitFor("Boolean(document.querySelector('#personalizacja'))", "personalization entry");
    const opened = await evaluate(`(() => { const button=[...document.querySelectorAll('button')].find((node)=>node.textContent?.includes('Uruchom konfigurator')); if(!button)return false; button.click(); return true; })()`);
    if (!opened) throw new Error("Could not find the 'Uruchom konfigurator' button.");
    await waitFor("Boolean(document.querySelector('.abags-vc-dialog'))", "visual customizer dialog");
    await waitFor("Boolean(document.querySelector('.abags-vc-base')?.getAttribute('src'))", "base product image");
    await waitFor("Boolean(document.querySelector('[data-abags-realtime-preview]'))", "realtime canvas");
    await waitFor("(document.querySelector('[data-abags-realtime-preview]')?.width || 0) > 20", "rendered realtime canvas pixels");
    await waitFor("Boolean(document.querySelector('.abags-exact-reference-library'))", "exact reference library");

    const fingerprint = async () => evaluate(`(() => { const canvas=document.querySelector('[data-abags-realtime-preview]'); if(!canvas||!canvas.width||!canvas.height)return ''; try{const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let hash=2166136261>>>0;const step=Math.max(4,Math.floor(data.length/12000));for(let i=0;i<data.length;i+=step){hash^=data[i];hash=Math.imul(hash,16777619)>>>0;}return canvas.width+'x'+canvas.height+':'+hash.toString(16);}catch(error){return 'canvas-error:'+String(error?.message||error);} })()`);
    const waitFingerprintChange = async (before, label) => {
      const deadline = Date.now() + renderTimeoutMs;
      let value = before;
      while (Date.now() < deadline) {
        value = await fingerprint();
        if (value && value !== before && !String(value).startsWith("canvas-error:")) return value;
        await sleep(100);
      }
      throw new Error(`${label} did not change the realtime render within ${renderTimeoutMs} ms. Fingerprint: ${value}`);
    };
    const clickOption = async (fieldset, text) => {
      const clicked = await evaluate(`(() => { const fieldset=document.querySelector('.abags-vc-controls fieldset:nth-child(${fieldset})'); const button=[...(fieldset?.querySelectorAll('button')||[])].find((node)=>node.textContent?.includes(${JSON.stringify(text)})); if(!button)return false; button.click(); return true; })()`);
      if (!clicked) throw new Error(`Missing customizer option ${fieldset}: ${text}`);
    };

    let current = await fingerprint();
    if (!current || String(current).startsWith("canvas-error:")) throw new Error(`Realtime canvas cannot be sampled: ${current}`);
    await clickOption(2, "Pudrowy róż"); current = await waitFingerprintChange(current, "Changing colour");
    await waitFor("document.querySelector('.abags-vc-controls fieldset:nth-child(2) button.is-active')?.textContent?.includes('Pudrowy róż')", "selected colour state");
    await clickOption(4, "Drewniane"); current = await waitFingerprintChange(current, "Changing handles");
    await clickOption(5, "Srebrne"); current = await waitFingerprintChange(current, "Changing hardware");
    await clickOption(6, "Regulowany"); current = await waitFingerprintChange(current, "Changing strap");
    await clickOption(7, "Chwost"); current = await waitFingerprintChange(current, "Changing accent");

    const stitchButtons = await evaluate("document.querySelectorAll('.abags-vc-controls fieldset:nth-child(3) button').length");
    if (!stitchButtons) throw new Error("Stitch selector is empty in production.");
    if (stitchButtons > 1) {
      const beforeStitch = current;
      const clicked = await evaluate(`(() => { const buttons=[...document.querySelectorAll('.abags-vc-controls fieldset:nth-child(3) button')]; const button=buttons.find((item)=>!item.classList.contains('is-active')); if(!button)return false; button.click(); return true; })()`);
      if (clicked) current = await waitFingerprintChange(beforeStitch, "Changing stitch");
    }

    await waitFor("Boolean([...document.querySelectorAll('button')].find((node)=>node.textContent?.includes('Porównaj z bazą')))", "compare-with-base control");
    await evaluate(`(() => { const button=[...document.querySelectorAll('button')].find((node)=>node.textContent?.includes('Porównaj z bazą')); button?.click(); return Boolean(button); })()`);
    await waitFor("document.querySelector('.abags-vc-preview')?.classList.contains('is-showing-base')", "untouched base comparison");
    await evaluate(`(() => { const button=[...document.querySelectorAll('button')].find((node)=>node.textContent?.includes('Pokaż projekt')); button?.click(); return Boolean(button); })()`);
    await waitFor("!document.querySelector('.abags-vc-preview')?.classList.contains('is-showing-base')", "return to project render");
    const exactReferenceCount = await evaluate("document.querySelectorAll('.abags-exact-reference-library button').length");
    if (!exactReferenceCount) throw new Error("Exact 1:1 reference library contains no selectable products.");

    const result = await evaluate(`(() => ({realtimeCanvas:Boolean(document.querySelector('[data-abags-realtime-preview]')),liveBadge:document.querySelector('.abags-realtime-preview-badge')?.textContent||'',exactReferences:document.querySelectorAll('.abags-exact-reference-library button').length,selectedColor:document.querySelector('.abags-vc-controls fieldset:nth-child(2) button.is-active')?.textContent||'',selectedHandles:document.querySelector('.abags-vc-controls fieldset:nth-child(4) button.is-active')?.textContent||'',selectedHardware:document.querySelector('.abags-vc-controls fieldset:nth-child(5) button.is-active')?.textContent||'',selectedStrap:document.querySelector('.abags-vc-controls fieldset:nth-child(6) button.is-active')?.textContent||'',selectedAccent:document.querySelector('.abags-vc-controls fieldset:nth-child(7) button.is-active')?.textContent||''}))()`);
    console.log("Realtime Visual Customizer browser smoke passed:", JSON.stringify(result));
    socket.close();
  } finally {
    chrome.kill("SIGTERM"); await sleep(200); if (!chrome.killed) chrome.kill("SIGKILL"); if (process.env.ABAGS_DEBUG_CHROME === "1" && chromeLog) console.error(chromeLog);
  }
}

main().catch((error) => { console.error(`Realtime Visual Customizer browser smoke failed: ${error instanceof Error ? error.stack || error.message : String(error)}`); process.exitCode = 1; });
