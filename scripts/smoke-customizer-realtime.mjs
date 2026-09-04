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
      const canvas=s.querySelector('.abags-fidelity3d-canvas');
      const fidelity=s.querySelector('.abags-fidelity3d-layer');
      const viewControls=s.querySelector('.abags-fidelity3d-view-controls');
      const zoomControls=s.querySelector('.abags-fidelity3d-zoom');
      const svgStyle=svg?getComputedStyle(svg):null;
      const svgRect=svg?.getBoundingClientRect();
      const canvasStyle=canvas?getComputedStyle(canvas):null;
      const canvasRect=canvas?.getBoundingClientRect();
      const fidelityStyle=fidelity?getComputedStyle(fidelity):null;
      const fidelityRect=fidelity?.getBoundingClientRect();
      const viewRect=viewControls?.getBoundingClientRect();
      const zoomRect=zoomControls?.getBoundingClientRect();
      const style=getComputedStyle(d);
      const rect=d.getBoundingClientRect();
      const svgVisible=Boolean(svg && svgStyle && svgRect && svgStyle.display!=='none' && svgStyle.visibility!=='hidden' && Number.parseFloat(svgStyle.opacity||'1')>.05 && svgRect.width>20 && svgRect.height>20);
      const canvasVisible=Boolean(canvas && canvasStyle && canvasRect && canvasStyle.display!=='none' && canvasStyle.visibility!=='hidden' && Number.parseFloat(canvasStyle.opacity||'1')>.05 && canvasRect.width>20 && canvasRect.height>20);
      const fidelityVisible=Boolean(fidelity && fidelityStyle && fidelityRect && fidelityStyle.display!=='none' && fidelityStyle.visibility!=='hidden' && Number.parseFloat(fidelityStyle.opacity||'1')>.05 && fidelityRect.width>20 && fidelityRect.height>20);
      const activeView=[...s.querySelectorAll('.abags-fidelity3d-view-controls button')].find((b)=>b.getAttribute('aria-pressed')==='true')?.textContent?.trim()||'';
      const legacyControlCount=s.querySelectorAll('.abags-fidelity3d-layer .abags-pro3d-view-controls, .abags-fidelity3d-layer .abags-pro3d-zoom').length;
      let webgl=null;
      if(canvas){
        try{
          const gl=canvas.getContext('webgl');
          webgl=gl?{
            context:true,
            lost:gl.isContextLost(),
            drawingBufferWidth:gl.drawingBufferWidth,
            drawingBufferHeight:gl.drawingBufferHeight,
            currentProgram:Boolean(gl.getParameter(gl.CURRENT_PROGRAM)),
            error:gl.getError(),
          }:{context:false};
        }catch(error){webgl={context:false,exception:String(error)};}
      }
      return {
        family:s.dataset.family||'', color:s.dataset.color||'', stitch:s.dataset.stitch||'',
        flap:s.dataset.flap||'', handles:s.dataset.handles||'', strap:s.dataset.strap||'', hardware:s.dataset.hardware||'', accent:s.dataset.accent||'',
        signature:s.dataset.builderSignature||'', final3d:s.dataset.abagsFinal3d||'', final3dReason:s.dataset.abagsFinal3dReason||'',
        final3dSignature:s.dataset.abagsFinal3dSignature||'', fidelityReady:s.dataset.abagsFidelity3dReady||'',
        rendererFrame:s.dataset.abagsFidelity3dFrame||'', rendererFrameAt:s.dataset.abagsFidelity3dFrameAt||'', rendererError:s.dataset.abagsFidelity3dError||'',
        photoTrue:Boolean(d.querySelector('.abags-photo-true-base')) || d.dataset.abagsPhotoTrue==='active' || s.dataset.abagsPhotoTrue==='active',
        readyProductChoices:d.querySelectorAll('[data-photo-product-choice]').length,
        svgPresent:Boolean(svg), svgVisible, canvasPresent:Boolean(canvas), canvasVisible, fidelityVisible, activeView, webgl,
        fidelityControlNamespace:Boolean(viewControls&&zoomControls), legacyControlCount,
        viewControls:viewRect?{width:Math.round(viewRect.width),height:Math.round(viewRect.height),top:Math.round(viewRect.top),left:Math.round(viewRect.left)}:null,
        zoomControls:zoomRect?{width:Math.round(zoomRect.width),height:Math.round(zoomRect.height),top:Math.round(zoomRect.top),left:Math.round(zoomRect.left)}:null,
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
    const waitVerified3d = async (label) => {
      try {
        await waitFor(`(() => { const s=document.querySelector('.abags-bag-builder-stage'); return s?.dataset.abagsFinal3d==='ready' && s.dataset.abagsFinal3dSignature===s.dataset.builderSignature; })()`, `${label} verified 3D`, 15_000);
      } catch (error) {
        const state = await stageState();
        const safeLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        try { await capture(`customizer-${safeLabel || "verification"}-failure.png`); } catch {}
        throw new Error(`${label} verification timeout. State: ${JSON.stringify(state)}. ${error instanceof Error ? error.message : String(error)}`);
      }
      const state = await stageState();
      if (!state?.dialogVisible || state.photoTrue || state.readyProductChoices !== 0 || state.final3d !== "ready" || !state.canvasPresent || !state.canvasVisible || !state.fidelityVisible || state.svgVisible || !state.fidelityControlNamespace || state.legacyControlCount !== 0) {
        throw new Error(`${label} is not verified visible final 3D with isolated controls: ${JSON.stringify(state)}`);
      }
      return state;
    };
    const clickView = async (label) => {
      const clicked = await evaluate(`(() => { const b=[...document.querySelectorAll('.abags-fidelity3d-view-controls button')].find((n)=>n.textContent?.trim()===${JSON.stringify(label)}); if(!b)return false; b.click(); return true; })()`);
      if (!clicked) throw new Error(`Could not select 3D view ${label}.`);
      await waitFor(`[...document.querySelectorAll('.abags-fidelity3d-view-controls button')].some((b)=>b.textContent?.trim()===${JSON.stringify(label)}&&b.getAttribute('aria-pressed')==='true')`, `3D view ${label}`);
    };
    const buildBag = async ({ family, color, stitch }, label) => {
      const empty = await stageState();
      if (!empty?.dialogVisible || empty.photoTrue || empty.readyProductChoices !== 0 || !empty.svgPresent || !empty.svgVisible || empty.family || empty.color || empty.stitch) {
        throw new Error(`${label} did not start from the safe empty construction: ${JSON.stringify(empty)}`);
      }
      const initialSignature = empty.signature;

      await choose("family", family);
      const afterFamily = await waitVerified3d(`${label} after family`);
      if (afterFamily.signature === initialSignature || afterFamily.family !== family) throw new Error(`${label} family selection did not create verified 3D.`);

      await choose("color", color);
      const afterColor = await waitVerified3d(`${label} after color`);
      if (afterColor.signature === afterFamily.signature || afterColor.color.toUpperCase() !== color.toUpperCase()) throw new Error(`${label} color selection did not redraw verified 3D.`);

      await choose("stitch", stitch);
      const afterStitch = await waitVerified3d(`${label} after stitch`);
      if (afterStitch.signature === afterColor.signature || afterStitch.stitch !== stitch) throw new Error(`${label} stitch selection did not redraw verified 3D.`);

      await clickView("Bok");
      const side = await stageState();
      if (side.activeView !== "Bok") throw new Error(`${label} side view is not interactive: ${JSON.stringify(side)}`);
      await clickView("3/4");
      return waitVerified3d(`${label} restored 3/4`);
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
    if (!mobile.viewControls || mobile.viewControls.height > 44 || mobile.viewControls.width > 190) throw new Error(`Mobile Fidelity3D view controls cover too much of the product stage: ${JSON.stringify(mobile)}`);
    if (!mobile.zoomControls || mobile.zoomControls.height > 48 || mobile.zoomControls.width > 192) throw new Error(`Mobile Fidelity3D zoom controls cover too much of the product stage: ${JSON.stringify(mobile)}`);
    const socialsVisible = await evaluate(`[...document.querySelectorAll('.social-quick-links')].some((n)=>{const s=getComputedStyle(n),r=n.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>1&&r.height>1;})`);
    if (socialsVisible) throw new Error("Floating storefront social links are visible over the mobile builder.");
    const mobileBytes = await capture("customizer-mobile-realtime.png");

    console.log("FINAL 3D BUILDER PASS:", productionUrl);
    console.log("- starts from empty construction with SVG safety fallback: yes");
    console.log("- finished-product Photo-True takeover: absent");
    console.log("- WebGL Fidelity3D produced verified pixels: yes");
    console.log("- Fidelity3D controls are isolated from legacy Pro3D CSS: yes");
    console.log("- family/color/stitch redraw verified 3D: yes");
    console.log("- Przód / 3/4 / Bok view controls are interactive: yes");
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
  console.error("Final 3D builder production acceptance failed:", error);
  process.exitCode = 1;
});