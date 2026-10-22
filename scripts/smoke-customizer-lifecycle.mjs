import { spawn, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const baseUrl = process.env.ABAGS_PRODUCTION_URL || "https://abagshandmade.pl";
const outputDir = process.env.ABAGS_REALTIME_QA_DIR || "/tmp/abags-customizer-lifecycle";
const port = Number(process.env.ABAGS_LIFECYCLE_CHROME_DEBUG_PORT || 9794);
const stageSelector = '.abags-vc-dialog.abags-reference-layout-v4.abags-vc-builder-active .abags-vc-preview .abags-bag-builder-stage[data-abags-live-stage="true"]';
const stageExpression = `document.querySelector(${JSON.stringify(stageSelector)})`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function chromeBinary() {
  for (const candidate of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    const found = spawnSync("which", [candidate], { encoding: "utf8" });
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error("Chrome/Chromium is not available.");
}

async function waitJson(url, options = {}) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response.json();
    } catch {}
    await sleep(150);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function connectCdp(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("CDP connection timed out.")), 8_000);
    socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("CDP connection failed.")); }, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    clearTimeout(waiter.timer);
    if (message.error) waiter.reject(new Error(message.error.message));
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

async function main() {
  await mkdir(outputDir, { recursive: true });
  const binary = chromeBinary();
  const profileDir = await mkdtemp(path.join(os.tmpdir(), "abags-lifecycle-chrome-"));
  const chrome = spawn(binary, [
    "--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--disable-background-networking",
    "--disable-default-apps", "--no-first-run", "--use-gl=swiftshader", "--enable-unsafe-swiftshader",
    `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`, "about:blank",
  ], { stdio: "ignore" });
  let socket;
  let evaluate;
  let send;
  const evidence = {};
  try {
    await waitJson(`http://127.0.0.1:${port}/json/version`);
    const target = await waitJson(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" });
    ({ socket, send } = await connectCdp(target.webSocketDebuggerUrl));
    evaluate = async (expression) => {
      const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result?.value;
    };
    const waitFor = async (expression, label, timeout = 20_000) => {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        if (await evaluate(expression)) return;
        await sleep(120);
      }
      throw new Error(`Timed out waiting for ${label}.`);
    };
    const snapshot = () => evaluate(`(() => {
      const stage=${stageExpression};
      if(!stage)return null;
      const canvas=stage.querySelector('.abags-fidelity3d-canvas');
      const gl=canvas?.getContext('webgl');
      const rect=canvas?.getBoundingClientRect();
      const style=canvas?getComputedStyle(canvas):null;
      const pixels=gl && !gl.isContextLost()?new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4):null;
      let opaque=0,hash=2166136261>>>0,lowest=Infinity;
      if(pixels){
        gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        for(let i=0;i<pixels.length;i+=16){
          if(pixels[i+3]>24){opaque++;lowest=Math.min(lowest,Math.floor(i/4/gl.drawingBufferWidth));}
          for(let j=0;j<4;j++){hash^=pixels[i+j];hash=Math.imul(hash,16777619)>>>0;}
        }
      }
      const layer=stage.querySelector('.abags-fidelity3d-layer'),shadow=layer?getComputedStyle(layer,'::after'):null;
      const ground=JSON.parse(stage.dataset.abagsFidelityGrounding||'null');
      const shadowTop=shadow?.top.endsWith('%')?parseFloat(shadow.top)/100*layer.getBoundingClientRect().height:parseFloat(shadow?.top||'NaN');
      return {
        grounding:ground&&gl&&rect?{...ground,shadowTop,shadowOpacity:Number(shadow?.opacity),shadowDisplay:shadow?.display,pointerEvents:shadow?.pointerEvents,pixelBottom:(1-lowest/gl.drawingBufferHeight)*rect.height,height:rect.height}:null,
        rimTriangles:Number(stage.dataset.abagsFidelityRimTriangles||0),
        family:stage.dataset.family,color:stage.dataset.color,stitch:stage.dataset.stitch,
        signature:stage.dataset.builderSignature,frame:stage.dataset.abagsFidelity3dFrame,
        frameAt:stage.dataset.abagsFidelity3dFrameAt,canvasFrame:canvas?.dataset.abagsFidelity3dFrame,
        finalSignature:stage.dataset.abagsFinal3dSignature,final:stage.dataset.abagsFinal3d,
        error:stage.dataset.abagsFidelity3dError||'',reason:stage.dataset.abagsFinal3dReason,
        rotationX:Number(stage.dataset.abagsFidelity3dRotationX),rotationY:Number(stage.dataset.abagsFidelity3dRotationY),
        zoom:Number(stage.dataset.abagsFidelity3dZoom),lost:gl?.isContextLost(),
        visible:Boolean(rect&&style&&rect.width>40&&rect.height>40&&style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)>.05),
        pixels:opaque,hash:hash.toString(16),webgl:gl?{width:gl.drawingBufferWidth,height:gl.drawingBufferHeight}:null,
      };
    })()`);
    const verified = async (label) => {
      await waitFor(`(() => {const s=${stageExpression};return s?.dataset.abagsFinal3d==='ready'&&s.dataset.abagsFinal3dSignature===s.dataset.builderSignature&&s.dataset.abagsFidelity3dFrame===s.dataset.builderSignature&&!s.dataset.abagsFidelity3dError;})()`, label);
      // Camera metadata is published before the React render effect's next RAF.
      // Read pixels only after that queued draw, including observer-driven paints.
      await evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))");
      const state = await snapshot();
      if (!state?.visible || state.lost || state.pixels < 100 || state.canvasFrame !== state.signature) {
        throw new Error(`${label}: missing visible rendered model: ${JSON.stringify(state)}`);
      }
      const ground=state.grounding;
      if(!ground||state.rimTriangles<1000)throw new Error(`${label}: missing braided rim or projected ground contact.`);
      if(ground.visible&&ground.pixelBottom<ground.height-4&&(ground.shadowDisplay==='none'||ground.shadowOpacity<.05||ground.pointerEvents!=='none'||Math.abs(ground.shadowTop-ground.pixelBottom)>5))throw new Error(`${label}: studio shadow drifted from the visible bag base: ${JSON.stringify(ground)}`);
      return state;
    };
    const waitRepaint = (before, label) => waitFor(`${stageExpression}?.dataset.abagsFidelity3dFrameAt!==${JSON.stringify(before.frameAt)}`, `${label} fresh framebuffer`);
    let mobile = false;
    const tapPoint = async ({ x, y }) => {
      if (mobile) {
        await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
        await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      } else {
        await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
        await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
        await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
      }
    };
    const click = async (selector, text = "") => {
      const point = await evaluate(`(() => {
        const button=[...document.querySelectorAll(${JSON.stringify(selector)})].find(n=>{
          const r=n.getBoundingClientRect(),s=getComputedStyle(n);
          return (!${JSON.stringify(text)}||n.textContent?.trim()===${JSON.stringify(text)})&&r.width>5&&r.height>5&&s.display!=='none'&&s.visibility!=='hidden';
        });
        if(!button)return null;
        const r=button.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);
        return {x,y,hit:hit?.tagName,hitClass:String(hit?.className||''),reached:hit===button||button.contains(hit)};
      })()`);
      if (!point) throw new Error(`Missing visible control: ${selector} ${text}`);
      evidence.lastClick = { selector, text, ...point };
      if (!mobile && !point.reached) throw new Error(`Control center is clipped or covered: ${JSON.stringify(evidence.lastClick)}`);
      await tapPoint({ x: point.x, y: point.y });
    };
    const open = async (waitForFrame = true) => {
      await waitFor("Boolean(document.querySelector('#personalizacja'))", "storefront", 60_000);
      if (!await evaluate(`(() => {const b=[...document.querySelectorAll('button')].find(n=>n.textContent?.includes('Uruchom konfigurator'));if(!b)return false;b.click();return true;})()`)) throw new Error("Cannot open configurator.");
      if (waitForFrame) return verified("open configurator");
      await waitFor(`Boolean(${stageExpression}?.querySelector('.abags-fidelity3d-canvas'))`, "unpainted canonical stage");
    };
    const choose = async (key, value) => {
      const before = await verified(`before ${key}`);
      if (!await evaluate(`(() => {
        const b=document.querySelector('.abags-vc-dialog.abags-vc-builder-active button[data-builder-key='+${JSON.stringify(JSON.stringify(key))}+'][data-builder-value='+${JSON.stringify(JSON.stringify(value))}+']');
        if(!b||b.disabled)return false;b.click();return true;
      })()`)) throw new Error(`Cannot choose ${key}=${value}`);
      await waitFor(`${stageExpression}?.dataset[${JSON.stringify(key)}]===${JSON.stringify(value)}`, `${key} selection`);
      const after = await verified(`${key} synchronized frame`);
      if (after.signature === before.signature || after.hash === before.hash) throw new Error(`${key} did not redraw model pixels.`);
      return after;
    };
    const canvasPoint = () => evaluate(`(() => {const r=${stageExpression}?.querySelector('.abags-fidelity3d-canvas')?.getBoundingClientRect();return r?{x:r.left+r.width/2,y:r.top+r.height/2}:null;})()`);
    const drag = async (label) => {
      const before = await verified(`${label} before drag`);
      const point = await canvasPoint();
      if (!point) throw new Error(`${label}: no canvas for drag.`);
      if (mobile) await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...point, id: 1 }] });
      else await send("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 });
      for (let step = 1; step <= 5; step++) {
        const next = { x: point.x + step * 10, y: point.y + step * 3 };
        if (mobile) await send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...next, id: 1 }] });
        else await send("Input.dispatchMouseEvent", { type: "mouseMoved", ...next, button: "left", buttons: 1 });
        await sleep(35);
      }
      if (mobile) await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      else await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x + 50, y: point.y + 15, button: "left", clickCount: 1 });
      await waitFor(`Math.abs(Number(${stageExpression}?.dataset.abagsFidelity3dRotationY)-(${before.rotationY}))>.2`, `${label} pointer rotation`);
      await waitRepaint(before, label);
      const after = await verified(`${label} after drag`);
      if (after.hash === before.hash) throw new Error(`${label}: drag changed metadata without redrawing model.`);
      return after;
    };
    const zoomButtons = async (label) => {
      const before = await verified(`${label} before zoom`);
      await click(`${stageSelector} .abags-fidelity3d-layer button[aria-label="Przybliż model"]`);
      await waitFor(`Number(${stageExpression}?.dataset.abagsFidelity3dZoom)>${before.zoom + 0.05}`, `${label} zoom in`);
      await waitRepaint(before, `${label} zoom in`);
      const enlarged = await verified(`${label} zoom in pixels`);
      if (enlarged.hash === before.hash) throw new Error(`${label}: zoom did not redraw pixels.`);
      await click(`${stageSelector} .abags-fidelity3d-layer button[aria-label="Oddal model"]`);
      await waitFor(`Math.abs(Number(${stageExpression}?.dataset.abagsFidelity3dZoom)-${before.zoom})<.005`, `${label} zoom out`);
      await waitRepaint(enlarged, `${label} zoom out`);
      return verified(`${label} zoom out pixels`);
    };
    const resizeStage = async (label) => {
      const before = await verified(`${label} before stage resize`);
      await evaluate(`(() => {
        const stage=${stageExpression};
        window.__abagsLifecycleWidth={value:stage.style.getPropertyValue('width'),priority:stage.style.getPropertyPriority('width')};
        stage.style.setProperty('width',Math.round(stage.getBoundingClientRect().width-40)+'px','important');
      })()`);
      await waitFor(`(() => {const c=${stageExpression}?.querySelector('.abags-fidelity3d-canvas');return c&&c.width!==${before.webgl.width};})()`, `${label} element-only resize`);
      await waitRepaint(before, `${label} stage resize`);
      await verified(`${label} resized frame`);
      await evaluate(`(() => {
        const stage=${stageExpression},saved=window.__abagsLifecycleWidth;
        if(saved.value)stage.style.setProperty('width',saved.value,saved.priority);else stage.style.removeProperty('width');
        delete window.__abagsLifecycleWidth;
      })()`);
      await waitFor(`(() => {const c=${stageExpression}?.querySelector('.abags-fidelity3d-canvas');return c?.width===${before.webgl.width}&&c?.height===${before.webgl.height};})()`, `${label} original stage size`);
      const restored = await verified(`${label} stage size restored`);
      if (restored.hash !== before.hash || restored.rotationX !== before.rotationX || restored.rotationY !== before.rotationY || restored.zoom !== before.zoom) {
        throw new Error(`${label}: stage resize repainted with a stale camera: ${JSON.stringify({ before, restored })}`);
      }
      return restored;
    };
    const resetCamera = async (label) => {
      const before = await verified(`${label} before reset test`);
      await click(`${stageSelector} .abags-fidelity3d-layer button[aria-label="Przybliż model"]`);
      await waitFor(`Number(${stageExpression}?.dataset.abagsFidelity3dZoom)>${before.zoom + 0.05}`, `${label} zoom before reset`);
      await waitRepaint(before, `${label} zoom before reset`);
      const enlarged = await verified(`${label} before camera reset`);
      await click(`${stageSelector} .abags-fidelity3d-layer .abags-pro3d-reset`);
      await waitFor(`(() => {const s=${stageExpression};return Math.abs(Number(s?.dataset.abagsFidelity3dZoom)-.92)<.002&&Math.abs(Number(s?.dataset.abagsFidelity3dRotationX)+.12)<.002&&Math.abs(Number(s?.dataset.abagsFidelity3dRotationY)+.62)<.002;})()`, `${label} reset camera`);
      await waitRepaint(enlarged, `${label} reset camera`);
      const reset = await verified(`${label} reset pixels`);
      if (reset.hash === enlarged.hash) throw new Error(`${label}: reset changed metadata without model pixels.`);
      return reset;
    };
    const recoverContext = async (label) => {
      const before = await verified(`${label} before context loss`);
      const available = await evaluate(`(() => {
        const canvas=${stageExpression}?.querySelector('.abags-fidelity3d-canvas');
        const gl=canvas?.getContext('webgl'),extension=gl?.getExtension('WEBGL_lose_context');
        if(!extension)return false;
        window.__abagsLifecycleContext={canvas,gl,extension};extension.loseContext();return true;
      })()`);
      if (!available) throw new Error(`${label}: WEBGL_lose_context unavailable; recovery was not exercised.`);
      await waitFor(`(() => {const s=${stageExpression};return window.__abagsLifecycleContext?.gl.isContextLost()&&s?.dataset.abagsFinal3d==='fallback'&&!s.classList.contains('abags-final3d-ready');})()`, `${label} context loss fallback`);
      const lost = await snapshot();
      await sleep(150);
      await evaluate("window.__abagsLifecycleContext.extension.restoreContext()");
      await waitFor("!window.__abagsLifecycleContext.gl.isContextLost()", `${label} context restored`);
      const recovered = await verified(`${label} recovered pixels`);
      if (recovered.signature !== before.signature || recovered.frameAt === before.frameAt) throw new Error(`${label}: context recovery did not repaint current configuration.`);
      await zoomButtons(`${label} recovered`);
      await drag(`${label} recovered`);
      await evaluate("delete window.__abagsLifecycleContext");
      return { before, lost, recovered };
    };
    const revealDelayedStage = async () => {
      const openedAt = Date.now();
      await open(false);
      // Keep the first canonical paint unavailable beyond the controller's 2s
      // readiness deadline. This reproduces an initially hidden preview/tab.
      await sleep(Math.max(0, 2_600 - (Date.now() - openedAt)));
      await waitFor(`(() => {const s=${stageExpression};return s?.dataset.abagsFinal3d==='fallback';})()`, "delayed first-frame fallback");
      const waiting = await snapshot();
      evidence.delayedFirstFrame = { waiting, hiddenForMs: Date.now() - openedAt };
      if (waiting.reason !== "current-frame-not-drawn" || waiting.frame || waiting.visible) {
        throw new Error(`Hidden stage did not wait for its first frame: ${JSON.stringify(waiting)}`);
      }
      // Reveal with CSS only: recovery must happen without configuration changes,
      // resize events, synthetic readiness metadata, or a customer pointer action.
      await evaluate("document.documentElement.removeAttribute('data-abags-delay-first-frame');document.querySelector('#abags-delay-first-frame')?.remove()");
      const recovered = await verified("automatic first visible frame after readiness timeout");
      evidence.delayedFirstFrame.recovered = recovered;
      await drag("delayed first frame recovered");
      await zoomButtons("delayed first frame recovered");
      console.log("delayed first frame: timed-out hidden stage automatically recovers visible pixels and controls PASS");
    };

    await send("Runtime.enable");
    await send("Page.enable");
    for (const viewport of [
      { label: "desktop", width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
      { label: "tablet", width: 800, height: 900, deviceScaleFactor: 1, mobile: false },
      { label: "mobile", width: 390, height: 844, deviceScaleFactor: 2, mobile: true },
    ]) {
      const { label, ...metrics } = viewport;
      mobile = viewport.mobile;
      let delayedScript;
      if (label === "desktop") {
        const result = await send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
          const install=()=>{
            if(!document.documentElement)return false;
            document.documentElement.setAttribute('data-abags-delay-first-frame','true');
            const style=document.createElement('style');style.id='abags-delay-first-frame';
            style.textContent='html[data-abags-delay-first-frame] body .abags-bag-builder-stage{display:none!important;width:1px!important;height:1px!important;min-width:0!important;min-height:0!important;max-width:1px!important;max-height:1px!important}';
            document.documentElement.appendChild(style);return true;
          };
          if(!install()){const observer=new MutationObserver(()=>{if(install())observer.disconnect()});observer.observe(document,{childList:true,subtree:true})}
        })()` });
        delayedScript = result.identifier;
      }
      await send("Emulation.setDeviceMetricsOverride", metrics);
      await send("Emulation.setTouchEmulationEnabled", { enabled: mobile, maxTouchPoints: 5 });
      await send("Page.navigate", { url: `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}abags-lifecycle=${Date.now()}` });
      await waitFor("document.readyState==='complete'&&Boolean(document.querySelector('#personalizacja'))", `${label} load`, 60_000);
      await evaluate("localStorage.removeItem('abags-bag-builder-v3');localStorage.removeItem('abags-photo-true-v1');localStorage.removeItem('abags-customizer-draft-v2')");
      await send("Page.reload", { ignoreCache: true });
      await waitFor("document.readyState==='complete'&&Boolean(document.querySelector('#personalizacja'))", `${label} clean load`, 60_000);
      if (delayedScript) {
        await revealDelayedStage();
        await send("Page.removeScriptToEvaluateOnNewDocument", { identifier: delayedScript });
      } else await open();
      await choose("family", "mini");
      await choose("color", "#E4A9B5");
      await choose("stitch", "herringbone");
      const changed = await choose("color", "#087E81");
      await click(`${stageSelector} .abags-fidelity3d-layer .abags-fidelity3d-view-controls button, ${stageSelector} .abags-fidelity3d-layer .abags-pro3d-view-controls button`, "Przód");
      await waitFor(`Math.abs(Number(${stageExpression}?.dataset.abagsFidelity3dRotationY))<.002`, `${label} front view`);
      await drag(label);
      await zoomButtons(label);
      if (mobile) {
        const before = await verified("before pinch");
        const point = await canvasPoint();
        await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: point.x - 30, y: point.y, id: 1 }, { x: point.x + 30, y: point.y, id: 2 }] });
        await sleep(60);
        for (let distance = 35; distance <= 40; distance += 5) {
          await send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: point.x - distance, y: point.y, id: 1 }, { x: point.x + distance, y: point.y, id: 2 }] });
          await sleep(60);
        }
        await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await waitFor(`Number(${stageExpression}?.dataset.abagsFidelity3dZoom)>${before.zoom + 0.1}`, "pinch increases zoom");
        await waitRepaint(before, "pinch");
        const after = await verified("after pinch");
        if (after.hash === before.hash) throw new Error("Pinch changed metadata without model pixels.");
      }
      await resizeStage(label);
      const recovery = await recoverContext(label);
      await click('.abags-vc-dialog.abags-reference-layout-v4 .abags-vc-header > button[aria-label="Zamknij"]:not(.abags-v4-header-tool)');
      await waitFor(`!${stageExpression}`, `${label} closed dialog`);
      const reopened = await open();
      if (reopened.signature !== changed.signature) throw new Error(`${label}: reopening lost current configuration: ${JSON.stringify(reopened)}`);
      await drag(`${label} reopened`);
      await zoomButtons(`${label} reopened`);
      await resetCamera(label);
      evidence[label] = { changed, recovery, reopened, final: await verified(`${label} final`) };
      const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      await writeFile(path.join(outputDir, `${label}.png`), Buffer.from(shot.data, "base64"));
      console.log(`${label}: model configuration, drag, zoom/reset${mobile ? ", pinch" : ""}, element resize, context recovery and reopen PASS`);
    }
    await writeFile(path.join(outputDir, "evidence.json"), JSON.stringify({ baseUrl, ...evidence }, null, 2));
    console.log("CUSTOMIZER LIFECYCLE PASS:", baseUrl);
  } catch (error) {
    if (evaluate) {
      try { evidence.failure = await evaluate(`({stage:${stageExpression}?.outerHTML?.slice(0,18000),url:location.href})`); } catch {}
      try { const shot = await send("Page.captureScreenshot", { format: "png" }); await writeFile(path.join(outputDir, "failure.png"), Buffer.from(shot.data, "base64")); } catch {}
    }
    await writeFile(path.join(outputDir, "evidence.json"), JSON.stringify({ baseUrl, ...evidence }, null, 2));
    throw error;
  } finally {
    try { socket?.close(); } catch {}
    chrome.kill("SIGTERM");
    await new Promise((resolve) => {
      if (chrome.exitCode !== null || chrome.signalCode !== null) return resolve();
      const timer = setTimeout(() => { chrome.kill("SIGKILL"); resolve(); }, 2_000);
      chrome.once("exit", () => { clearTimeout(timer); resolve(); });
    });
    await rm(profileDir, { recursive: true, force: true, maxRetries: 3 });
  }
}

main().catch((error) => { console.error("Customizer lifecycle failed:", error); process.exitCode = 1; });
