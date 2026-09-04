import { spawn, spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const productionUrl = process.env.ABAGS_PRODUCTION_URL || "https://abagshandmade.pl";
const port = Number(process.env.ABAGS_CLOSE_DEBUG_PORT || 9888);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function chromeBinary() {
  for (const candidate of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    const found = spawnSync("which", [candidate], { encoding: "utf8" });
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error("Chrome/Chromium is not available.");
}

async function waitJson(url, options = {}) {
  const deadline = Date.now() + 45_000;
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
    const timer = setTimeout(() => reject(new Error("CDP connection timed out")), 8_000);
    socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("CDP connection failed")); }, { once: true });
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
    const timer = setTimeout(() => { pending.delete(messageId); reject(new Error(`CDP timeout: ${method}`)); }, 8_000);
    pending.set(messageId, { resolve, reject, timer });
    socket.send(JSON.stringify({ id: messageId, method, params }));
  });
  return { socket, send };
}

function valueOf(result) {
  if (result?.exceptionDetails) throw new Error(result.exceptionDetails.text || "Runtime evaluation failed");
  return result?.result?.value;
}

async function main() {
  const binary = chromeBinary();
  const url = `${productionUrl}${productionUrl.includes("?") ? "&" : "?"}abags-close-diagnostics=${Date.now()}`;
  const chrome = spawn(binary, [
    "--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--disable-background-networking",
    "--disable-default-apps", "--no-first-run", "--use-gl=swiftshader", "--enable-unsafe-swiftshader",
    `--remote-debugging-port=${port}`, "about:blank",
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
      const deadline = Date.now() + 45_000;
      while (Date.now() < deadline) {
        if (await evaluate(expression)) return;
        await sleep(150);
      }
      throw new Error(`Timed out waiting for ${label}`);
    };

    await send("Runtime.enable");
    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await waitFor("document.readyState === 'complete'", "production page");
    await waitFor("Boolean(document.querySelector('#personalizacja'))", "personalization entry");
    const opened = await evaluate(`(() => { const b=[...document.querySelectorAll('button')].find((n)=>n.textContent?.includes('Uruchom konfigurator')); if(!b)return false; b.click(); return true; })()`);
    if (!opened) throw new Error("Could not open customizer");
    await waitFor("Boolean(document.querySelector('.abags-vc-dialog.abags-reference-layout-v4'))", "V4 dialog");
    await sleep(1200);

    const state = await evaluate(`(() => {
      const dialog=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4');
      const header=dialog?.querySelector('.abags-vc-header');
      const serializeStyle=(node,pseudo=null)=>{
        if(!node)return null;
        const s=getComputedStyle(node,pseudo);
        return {
          display:s.display,visibility:s.visibility,opacity:s.opacity,position:s.position,
          width:s.width,height:s.height,fontSize:s.fontSize,fontFamily:s.fontFamily,lineHeight:s.lineHeight,
          color:s.color,background:s.background,backgroundColor:s.backgroundColor,backgroundImage:s.backgroundImage,
          content:s.content,transform:s.transform,overflow:s.overflow,fill:s.fill,stroke:s.stroke,strokeWidth:s.strokeWidth,
        };
      };
      const info=(button)=>{
        const r=button.getBoundingClientRect();
        const svg=button.querySelector('svg');
        const path=svg?.querySelector('path');
        const sr=svg?.getBoundingClientRect();
        const pr=path?.getBoundingClientRect();
        const cx=r.left+r.width/2,cy=r.top+r.height/2;
        return {
          ariaLabel:button.getAttribute('aria-label'),className:String(button.className||''),dataset:{...button.dataset},
          textContent:button.textContent,innerHTML:button.innerHTML,outerHTML:button.outerHTML,
          childNodes:[...button.childNodes].map((n)=>({type:n.nodeType,name:n.nodeName,text:n.textContent,html:n.outerHTML||null})),
          rect:{left:r.left,top:r.top,width:r.width,height:r.height},style:serializeStyle(button),
          before:serializeStyle(button,'::before'),after:serializeStyle(button,'::after'),
          svg:svg?{outerHTML:svg.outerHTML,rect:sr?{left:sr.left,top:sr.top,width:sr.width,height:sr.height}:null,style:serializeStyle(svg)}:null,
          path:path?{outerHTML:path.outerHTML,rect:pr?{left:pr.left,top:pr.top,width:pr.width,height:pr.height}:null,style:serializeStyle(path)}:null,
          centerStack:document.elementsFromPoint(cx,cy).slice(0,8).map((n)=>({tag:n.tagName,className:String(n.className?.baseVal??n.className??''),aria:n.getAttribute?.('aria-label'),html:(n.outerHTML||'').slice(0,240)})),
        };
      };
      return {
        dialogClass:dialog?.className||'', dialogDataset:dialog?{...dialog.dataset}:null,
        headerButtons:header?[...header.querySelectorAll(':scope > button')].map(info):[],
        allMarked:[...document.querySelectorAll('[data-abags-customer-close-icon]')].map((n)=>n.outerHTML),
        allCloseSvg:[...document.querySelectorAll('[data-abags-customer-close-svg]')].map((n)=>n.outerHTML),
        viewport:{width:innerWidth,height:innerHeight,devicePixelRatio},
      };
    })()`);

    console.log("ABAGS CLOSE LIVE DOM DIAGNOSTICS");
    console.log(JSON.stringify(state, null, 2));
    writeFileSync("close-diagnostics.json", JSON.stringify(state, null, 2));
    const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    writeFileSync("close-diagnostics.png", Buffer.from(shot.data, "base64"));
  } finally {
    try { socket?.close(); } catch {}
    chrome.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error("Close diagnostics failed:", error);
  process.exitCode = 1;
});
