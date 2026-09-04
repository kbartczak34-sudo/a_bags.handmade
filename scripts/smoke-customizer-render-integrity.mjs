import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const productionUrl = process.env.ABAGS_PRODUCTION_URL || "https://abagshandmade.pl";
const outputDir = process.env.ABAGS_REALTIME_QA_DIR || "";
const port = Number(process.env.ABAGS_RENDER_INTEGRITY_CHROME_DEBUG_PORT || 9781);
const timeoutMs = 60_000;
const cdpTimeoutMs = 12_000;
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

function writeArtifact(name, bytesOrText) {
  if (!outputDir) return;
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, name), bytesOrText);
}

async function main() {
  const binary = chromeBinary();
  const url = `${productionUrl}${productionUrl.includes("?") ? "&" : "?"}abags-render-integrity-qa=${Date.now()}`;
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
    const target = await waitJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
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
        await sleep(150);
      }
      throw new Error(`Timed out waiting for ${label}. Last value: ${JSON.stringify(value)}`);
    };

    const clearDraftAndReload = async () => {
      await evaluate(`(() => {
        try {
          localStorage.removeItem('abags-bag-builder-v3');
          localStorage.removeItem('abags-photo-true-v1');
          localStorage.removeItem('abags-customizer-draft-v2');
        } catch {}
        return true;
      })()`);
      await send("Page.reload", { ignoreCache: true });
      await waitFor("document.readyState === 'complete'", "document reload");
    };

    const openBuilder = async () => {
      await waitFor("Boolean(document.querySelector('#personalizacja'))", "personalization entry");
      const opened = await evaluate(`(() => {
        const button=[...document.querySelectorAll('button')].find((node)=>node.textContent?.includes('Uruchom konfigurator'));
        if(!button)return false;
        button.click();
        return true;
      })()`);
      if (!opened) throw new Error("Could not open the realtime customizer.");
      await waitFor("Boolean(document.querySelector('.abags-vc-dialog.abags-reference-layout-v4'))", "V4 realtime dialog");
      await waitFor("Boolean(document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-bag-builder-stage'))", "V4 realtime stage");
    };

    const choose = async (key, value) => {
      const clicked = await evaluate(`(() => {
        const button=[...document.querySelectorAll('button[data-builder-key=${JSON.stringify(key)}]')]
          .find((node)=>node.dataset.builderValue===${JSON.stringify(value)});
        if(!button || button.disabled)return false;
        button.click();
        return true;
      })()`);
      if (!clicked) throw new Error(`Could not select ${key}=${value}.`);
      await waitFor(
        `document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-bag-builder-stage')?.dataset[${JSON.stringify(key)}]===${JSON.stringify(value)}`,
        `${key}=${value}`,
      );
    };

    const waitReady = async (label) => {
      await waitFor(`(() => {
        const stage=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-bag-builder-stage');
        return stage?.dataset.abagsFinal3d==='ready' && stage.dataset.abagsFinal3dSignature===stage.dataset.builderSignature;
      })()`, `${label} ready Fidelity3D`, 20_000);
      await sleep(250);
    };

    const collectTruth = async (label) => evaluate(`(() => {
      const visible=(node)=>{
        if(!(node instanceof Element))return false;
        const style=getComputedStyle(node);
        const rect=node.getBoundingClientRect();
        return style.display!=='none' && style.visibility!=='hidden' && Number.parseFloat(style.opacity||'1')>.03 && rect.width>2 && rect.height>2;
      };
      const describe=(node)=>{
        const style=getComputedStyle(node);
        const rect=node.getBoundingClientRect();
        return {
          tag:node.tagName.toLowerCase(),
          id:node.id||'',
          className:typeof node.className==='string'?node.className:'',
          zIndex:style.zIndex,
          display:style.display,
          visibility:style.visibility,
          opacity:style.opacity,
          rect:{x:Math.round(rect.x),y:Math.round(rect.y),width:Math.round(rect.width),height:Math.round(rect.height)},
          src:node instanceof HTMLImageElement?(node.currentSrc||node.src||''):'',
          text:(node.textContent||'').trim().replace(/\\s+/g,' ').slice(0,90),
        };
      };
      const dialogs=[...document.querySelectorAll('.abags-vc-dialog')];
      const roots=[...document.querySelectorAll('.abags-vc-layer-root')];
      const v4=dialogs.find((dialog)=>dialog.classList.contains('abags-reference-layout-v4') && visible(dialog)) || dialogs.find((dialog)=>dialog.classList.contains('abags-reference-layout-v4')) || null;
      const stage=v4?.querySelector('.abags-bag-builder-stage')||null;
      const canvas=stage?.querySelector('.abags-fidelity3d-canvas')||null;
      const stageRect=stage?.getBoundingClientRect()||null;
      const selectors='.abags-vc-base,.abags-vc-layer,.abags-vc-exact-reference,.abags-photo-true-base,[data-photo-product-choice]';
      const legacy=v4?[...v4.querySelectorAll(selectors)].filter(visible).map(describe):[];
      const visibleImages=v4?[...v4.querySelectorAll('img')].filter(visible).map(describe):[];
      const stack=stageRect?[...document.elementsFromPoint(stageRect.left+stageRect.width/2,stageRect.top+stageRect.height/2)].slice(0,12).map(describe):[];
      return {
        label:${JSON.stringify(label)},
        href:location.href,
        title:document.title,
        bodyClass:document.body.className,
        dialogCount:dialogs.length,
        visibleDialogCount:dialogs.filter(visible).length,
        dialogs:dialogs.map((dialog)=>({...describe(dialog),visible:visible(dialog),photoTrue:dialog.dataset.abagsPhotoTrue||'',fidelityContract:dialog.dataset.abagsFidelityContract||''})),
        rootCount:roots.length,
        visibleRootCount:roots.filter(visible).length,
        roots:roots.map((root)=>({...describe(root),visible:visible(root)})),
        stage:stage?{
          ...describe(stage),
          family:stage.dataset.family||'',color:stage.dataset.color||'',stitch:stage.dataset.stitch||'',
          final3d:stage.dataset.abagsFinal3d||'',reason:stage.dataset.abagsFinal3dReason||'',
          signature:stage.dataset.builderSignature||'',finalSignature:stage.dataset.abagsFinal3dSignature||'',
          rendererFrame:stage.dataset.abagsFidelity3dFrame||'',rendererVisible:stage.dataset.abagsRendererVisible||'',
          pixels:stage.dataset.abagsFinal3dPixels||'',hueMatches:stage.dataset.abagsFinal3dHueMatches||'',
          expectedHue:stage.dataset.abagsFinal3dExpectedHue||'',averageHueDelta:stage.dataset.abagsFinal3dAverageHueDelta||'',
          photoTrue:stage.dataset.abagsPhotoTrue||'',
        }:null,
        canvas:canvas?{...describe(canvas),width:canvas.width,height:canvas.height}:null,
        visibleLegacy:legacy,
        visibleImages,
        pointStack:stack,
      };
    })()`);

    const assertCustomerSurface = (truth, label) => {
      if (!truth?.stage || truth.stage.final3d !== "ready") throw new Error(`${label}: final Fidelity3D stage is not ready: ${JSON.stringify(truth)}`);
      if (truth.visibleDialogCount !== 1) throw new Error(`${label}: expected exactly one visible customizer dialog, got ${truth.visibleDialogCount}: ${JSON.stringify(truth.dialogs)}`);
      if (truth.visibleRootCount !== 1) throw new Error(`${label}: expected exactly one visible customizer root, got ${truth.visibleRootCount}: ${JSON.stringify(truth.roots)}`);
      if (truth.visibleLegacy.length) throw new Error(`${label}: legacy/Photo-True product layer is visible in customer mode: ${JSON.stringify(truth.visibleLegacy)}`);
      const blockingImage = truth.pointStack.find((node) => node.tag === "img" && !node.className.includes("abags-ref-photo"));
      if (blockingImage) throw new Error(`${label}: an image overlays the realtime 3D stage: ${JSON.stringify(blockingImage)}`);
    };

    const captureFull = async (name) => {
      const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
      writeArtifact(name, Buffer.from(shot.data, "base64"));
      return shot.data;
    };

    const captureStage = async (name) => {
      const rect = await evaluate(`(() => {
        const stage=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-bag-builder-stage');
        if(!stage)return null;
        const r=stage.getBoundingClientRect();
        return {x:r.x,y:r.y,width:r.width,height:r.height};
      })()`);
      if (!rect || rect.width < 10 || rect.height < 10) throw new Error(`Cannot capture realtime stage: ${JSON.stringify(rect)}`);
      const shot = await send("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: false,
        clip: { x: Math.max(0, rect.x), y: Math.max(0, rect.y), width: rect.width, height: rect.height, scale: 1 },
      });
      writeArtifact(name, Buffer.from(shot.data, "base64"));
      return shot.data;
    };

    const captureNativeCanvas = async (name) => {
      const dataUrl = await evaluate(`(() => {
        const canvas=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-fidelity3d-canvas');
        return canvas instanceof HTMLCanvasElement?canvas.toDataURL('image/png'):'';
      })()`);
      if (!dataUrl?.startsWith("data:image/png;base64,")) throw new Error("Could not serialize Fidelity3D canvas.");
      const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
      writeArtifact(name, Buffer.from(base64, "base64"));
      return base64;
    };

    const analyzePng = async (base64, expectedColor) => evaluate(`(async()=>{
      const src=${JSON.stringify(`data:image/png;base64,${base64}`)};
      const expected=${JSON.stringify(expectedColor)};
      const image=new Image();
      image.src=src;
      await image.decode();
      const canvas=document.createElement('canvas');
      canvas.width=image.naturalWidth;
      canvas.height=image.naturalHeight;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      if(!ctx)return null;
      ctx.drawImage(image,0,0);
      const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      const hex=expected.replace('#','');
      const er=parseInt(hex.slice(0,2),16)/255,eg=parseInt(hex.slice(2,4),16)/255,eb=parseInt(hex.slice(4,6),16)/255;
      const hue=(r,g,b)=>{
        r/=255;g/=255;b/=255;
        const max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;
        const sat=max===0?0:delta/max;
        let h=0;
        if(delta){if(max===r)h=60*(((g-b)/delta)%6);else if(max===g)h=60*((b-r)/delta+2);else h=60*((r-g)/delta+4);if(h<0)h+=360;}
        return {h,sat};
      };
      const expectedHue=hue(er*255,eg*255,eb*255).h;
      const distance=(a,b)=>{const d=Math.abs(a-b)%360;return Math.min(d,360-d);};
      let sampled=0,opaque=0,chromatic=0,matches=0,strongMatches=0,brightNeutral=0,satTotal=0;
      const step=Math.max(1,Math.floor(Math.min(canvas.width,canvas.height)/90));
      for(let y=0;y<canvas.height;y+=step){for(let x=0;x<canvas.width;x+=step){
        const index=(y*canvas.width+x)*4;
        const r=data[index],g=data[index+1],b=data[index+2],a=data[index+3];
        sampled++;
        if(a<32)continue;
        opaque++;
        const hs=hue(r,g,b);
        const luma=.2126*r+.7152*g+.0722*b;
        if(hs.sat>=.12)chromatic++;
        if(luma>218&&hs.sat<.08)brightNeutral++;
        const delta=distance(hs.h,expectedHue);
        if(hs.sat>=.14&&delta<=42){matches++;satTotal+=hs.sat;if(hs.sat>=.26&&delta<=32)strongMatches++;}
      }}
      return {
        width:canvas.width,height:canvas.height,sampled,opaque,chromatic,matches,strongMatches,brightNeutral,
        matchRatio:sampled?matches/sampled:0,strongMatchRatio:sampled?strongMatches/sampled:0,
        brightNeutralRatio:sampled?brightNeutral/sampled:0,averageMatchSaturation:matches?satTotal/matches:0,
        expectedHue,
      };
    })()`);

    const configure = async ({ family, color, stitch }, label) => {
      await choose("family", family);
      await waitReady(`${label} family`);
      await choose("color", color);
      await waitReady(`${label} color`);
      await choose("stitch", stitch);
      await waitReady(`${label} stitch`);
    };

    await send("Runtime.enable");
    await send("Page.enable");

    const report = { target: { id: target.id || "", url: target.url || url, websocket: target.webSocketDebuggerUrl || "" }, desktop: null, mobile: null };

    await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await waitFor("document.readyState === 'complete'", "desktop initial load");
    await clearDraftAndReload();
    await openBuilder();
    await configure({ family: "tote", color: "#E4A9B5", stitch: "herringbone" }, "Desktop");
    const desktopBefore = await collectTruth("desktop-before-capture");
    assertCustomerSurface(desktopBefore, "Desktop");
    await captureFull("integrity-desktop-full.png");
    await captureStage("integrity-desktop-stage.png");
    const desktopNative = await captureNativeCanvas("integrity-desktop-canvas.png");
    const desktopAfter = await collectTruth("desktop-after-capture");
    assertCustomerSurface(desktopAfter, "Desktop after capture");
    report.desktop = { before: desktopBefore, after: desktopAfter, nativeCanvasBytes: desktopNative.length };

    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await clearDraftAndReload();
    await openBuilder();
    await configure({ family: "mini", color: "#087E81", stitch: "basket" }, "Mobile");
    const mobileBefore = await collectTruth("mobile-before-capture");
    assertCustomerSurface(mobileBefore, "Mobile");
    await captureFull("integrity-mobile-full.png");
    const mobileStage = await captureStage("integrity-mobile-stage.png");
    const mobileNative = await captureNativeCanvas("integrity-mobile-canvas.png");
    const stageColor = await analyzePng(mobileStage, "#087E81");
    const nativeColor = await analyzePng(mobileNative, "#087E81");
    const mobileAfter = await collectTruth("mobile-after-capture");
    assertCustomerSurface(mobileAfter, "Mobile after capture");
    report.mobile = { before: mobileBefore, after: mobileAfter, stageColor, nativeColor };

    writeArtifact("render-integrity.json", `${JSON.stringify(report, null, 2)}\n`);

    if (!nativeColor || nativeColor.strongMatchRatio < .035 || nativeColor.averageMatchSaturation < .22) {
      throw new Error(`Mobile native WebGL canvas does not visibly preserve selected turquoise: ${JSON.stringify(nativeColor)}`);
    }
    if (!stageColor || stageColor.strongMatchRatio < .035 || stageColor.averageMatchSaturation < .22) {
      throw new Error(`Mobile composited stage screenshot does not visibly preserve selected turquoise: ${JSON.stringify({ stageColor, nativeColor })}`);
    }

    console.log("REALTIME RENDER INTEGRITY PASS:", productionUrl);
    console.log("- exactly one visible customer customizer surface: yes");
    console.log("- legacy / Photo-True product overlays in customer mode: absent");
    console.log("- desktop full/stage/native canvas captured from the same CDP target: yes");
    console.log("- mobile native WebGL canvas preserves #087E81: yes");
    console.log("- mobile composited stage screenshot preserves #087E81: yes");
    console.log("- mobile screenshot color:", JSON.stringify(stageColor));
  } finally {
    try { socket?.close(); } catch {}
    chrome.kill("SIGTERM");
    await sleep(250);
    if (!chrome.killed) chrome.kill("SIGKILL");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
