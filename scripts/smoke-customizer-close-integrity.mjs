import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const productionUrl = process.env.ABAGS_PRODUCTION_URL || "https://abagshandmade.pl";
const outputDir = process.env.ABAGS_REALTIME_QA_DIR || "";
const port = Number(process.env.ABAGS_CLOSE_QA_CHROME_DEBUG_PORT || 9792);
const timeoutMs = 45_000;
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
    } catch (error) {
      lastError = error;
    }
    await sleep(150);
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

async function main() {
  const binary = chromeBinary();
  const chrome = spawn(binary, [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-background-networking",
    "--disable-default-apps",
    "--no-first-run",
    "--use-gl=swiftshader",
    "--enable-unsafe-swiftshader",
    `--remote-debugging-port=${port}`,
    "about:blank",
  ], { stdio: ["ignore", "pipe", "pipe"] });

  let socket;
  try {
    await waitJson(`http://127.0.0.1:${port}/json/version`);
    const target = await waitJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
    const cdp = await connectCdp(target.webSocketDebuggerUrl);
    socket = cdp.socket;
    const send = cdp.send;
    const evaluate = async (expression) => valueOf(await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    }));
    const waitFor = async (expression, label, deadlineMs = timeoutMs) => {
      const deadline = Date.now() + deadlineMs;
      let value;
      while (Date.now() < deadline) {
        value = await evaluate(expression);
        if (value) return value;
        await sleep(120);
      }
      throw new Error(`Timed out waiting for ${label}. Last value: ${JSON.stringify(value)}`);
    };

    await send("Runtime.enable");
    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    const url = `${productionUrl}${productionUrl.includes("?") ? "&" : "?"}abags-close-integrity-qa=${Date.now()}`;
    await send("Page.navigate", { url });
    await waitFor("document.readyState === 'complete'", "desktop production load");
    await waitFor("Boolean(document.querySelector('#personalizacja'))", "personalization entry");

    const opened = await evaluate(`(() => {
      const b=[...document.querySelectorAll('button')].find((n)=>n.textContent?.includes('Uruchom konfigurator'));
      if(!b)return false;
      b.click();
      return true;
    })()`);
    if (!opened) throw new Error("Could not open the realtime customizer for close integrity QA.");

    await waitFor("Boolean(document.querySelector('.abags-vc-dialog.abags-reference-layout-v4'))", "V4 customer dialog");
    await waitFor("Boolean(document.querySelector('.abags-vc-header > button[aria-label=\"Zamknij\"]'))", "customer close button");
    await sleep(600);

    const state = await evaluate(`(() => {
      const dialog=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4');
      const header=dialog?.querySelector('.abags-vc-header');
      const close=header?.querySelector('button[aria-label="Zamknij"]:not(.abags-v4-header-tool)');
      const headerButtons=[...(header?.querySelectorAll('button')||[])].map((button)=>({
        aria:button.getAttribute('aria-label')||'',
        className:String(button.className||''),
        text:button.textContent||'',
        marker:button.dataset.abagsCustomerCloseIcon||'',
      }));
      if(!dialog||!close)return {found:false,innerWidth,mediaDesktop:matchMedia('(min-width: 981px)').matches,headerButtons};

      const rect=close.getBoundingClientRect();
      const style=getComputedStyle(close);
      const before=getComputedStyle(close,'::before');
      const after=getComputedStyle(close,'::after');
      const surface=close.querySelector('[data-abags-customer-close-surface="true"]');
      const surfaceRect=surface?.getBoundingClientRect();
      const strokes=[...(surface?.children||[])].map((node)=>{
        const r=node.getBoundingClientRect();
        const s=getComputedStyle(node);
        return {
          tag:node.tagName,
          rect:{x:r.x,y:r.y,width:r.width,height:r.height},
          display:s.display,
          position:s.position,
          background:s.backgroundColor,
          transform:s.transform,
          left:s.left,
          top:s.top,
          pointerEvents:s.pointerEvents,
          inlineStyle:node.getAttribute('style')||'',
        };
      });
      const stack=document.elementsFromPoint(rect.x+rect.width/2,rect.y+rect.height/2).slice(0,10).map((node)=>({
        tag:node.tagName,
        className:String(node.className||''),
        aria:node.getAttribute?.('aria-label')||'',
        marker:node.dataset?.abagsCustomerCloseIcon||'',
        surface:node.dataset?.abagsCustomerCloseSurface||'',
        text:(node.textContent||'').trim().slice(0,60),
      }));

      return {
        found:true,
        innerWidth,
        mediaDesktop:matchMedia('(min-width: 981px)').matches,
        dialogClass:String(dialog.className||''),
        photoTrue:dialog.dataset.abagsPhotoTrue||'',
        headerButtons,
        close:{
          marker:close.dataset.abagsCustomerCloseIcon||'',
          text:close.textContent||'',
          html:close.innerHTML,
          rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},
          inlineStyle:close.getAttribute('style')||'',
          computed:{
            display:style.display,
            placeItems:style.placeItems,
            fontSize:style.fontSize,
            lineHeight:style.lineHeight,
            color:style.color,
            backgroundColor:style.backgroundColor,
            backgroundImage:style.backgroundImage,
            overflow:style.overflow,
          },
          before:{content:before.content,display:before.display,background:before.backgroundColor,transform:before.transform},
          after:{content:after.content,display:after.display,background:after.backgroundColor,transform:after.transform},
        },
        surface:surface?{
          present:true,
          rect:{x:surfaceRect.x,y:surfaceRect.y,width:surfaceRect.width,height:surfaceRect.height},
          childCount:surface.children.length,
          inlineStyle:surface.getAttribute('style')||'',
        }:{present:false,childCount:0},
        strokes,
        stack,
      };
    })()`);

    if (outputDir) {
      mkdirSync(outputDir, { recursive: true });
      writeFileSync(join(outputDir, "close-integrity.json"), `${JSON.stringify(state, null, 2)}\n`);
      const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
      writeFileSync(join(outputDir, "close-integrity-desktop.png"), Buffer.from(shot.data, "base64"));
    }

    console.log("CUSTOMER CLOSE INTEGRITY STATE:", JSON.stringify(state));

    const close = state?.close;
    const surface = state?.surface;
    const strokes = Array.isArray(state?.strokes) ? state.strokes : [];
    const problems = [];
    if (!state?.found) problems.push("close button not found");
    if (state?.innerWidth < 981) problems.push(`unexpected viewport ${state?.innerWidth}`);
    if (close?.marker !== "lines-v2") problems.push(`marker=${close?.marker || "missing"}`);
    if (!surface?.present) problems.push("close surface missing");
    if (surface?.childCount !== 2) problems.push(`stroke-count=${surface?.childCount ?? "missing"}`);
    if (close?.computed?.fontSize !== "0px") problems.push(`font-size=${close?.computed?.fontSize || "missing"}`);
    if (close?.computed?.display !== "grid") problems.push(`display=${close?.computed?.display || "missing"}`);
    if (strokes.length !== 2) problems.push(`computed-strokes=${strokes.length}`);
    if (strokes.some((stroke) => !stroke.transform || stroke.transform === "none")) problems.push("stroke transform missing");
    if (strokes.some((stroke) => stroke.rect?.width < 15 || stroke.rect?.width > 20 || stroke.rect?.height < 1 || stroke.rect?.height > 4)) problems.push("stroke geometry invalid");

    if (problems.length) {
      throw new Error(`Desktop customer close integrity failed: ${problems.join(", ")}. State: ${JSON.stringify(state)}`);
    }

    console.log("CUSTOMER CLOSE INTEGRITY PASS:", productionUrl);
    console.log("- marker: lines-v2");
    console.log("- deterministic strokes: 2");
    console.log("- current viewport desktop activation: yes");
  } finally {
    try { socket?.close(); } catch {}
    chrome.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error("Customer close production integrity failed:", error);
  process.exitCode = 1;
});
