import { spawn, spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const productionUrl = process.env.ABAGS_PRODUCTION_URL || "https://abagshandmade.pl";
const port = Number(process.env.ABAGS_VIEW_ANCHOR_CHROME_DEBUG_PORT || 9786);
const qaDir = process.env.ABAGS_REALTIME_QA_DIR || "artifacts/customizer-realtime";
const timeoutMs = 60_000;
const cdpTimeoutMs = 8_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const VIEW_PRESETS = {
  "Przód": { x: -0.02, y: 0 },
  "3/4": { x: -0.07, y: 0.46 },
  "Bok": { x: -0.035, y: Math.PI / 2 },
};

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

async function main() {
  const binary = chromeBinary();
  const url = `${productionUrl}${productionUrl.includes("?") ? "&" : "?"}abags-view-anchor-qa=${Date.now()}`;
  await mkdir(qaDir, { recursive: true });
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
        await sleep(120);
      }
      throw new Error(`Timed out waiting for ${label}. Last value: ${JSON.stringify(value)}`);
    };

    const clearAndReload = async () => {
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
      await waitFor("Boolean(document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-bag-builder-stage'))", "customer realtime stage");
      await waitFor(
        "document.querySelectorAll('.abags-vc-dialog.abags-reference-layout-v4 .abags-accessory-fidelity-canvas').length===2",
        "two accessory depth canvases",
      );
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
        if(!stage)return false;
        const canvases=stage.querySelectorAll('.abags-accessory-fidelity-canvas');
        return stage.dataset.abagsFinal3d==='ready' &&
          stage.dataset.abagsFinal3dSignature===stage.dataset.builderSignature &&
          stage.dataset.abagsFidelity3dFrame===stage.dataset.builderSignature &&
          canvases.length===2 &&
          !stage.dataset.abagsFidelity3dError;
      })()`, `${label} verified composition`, 20_000);
      await sleep(260);
    };

    const clickView = async (label) => {
      const expected = VIEW_PRESETS[label];
      if (!expected) throw new Error(`Unknown view preset ${label}.`);
      const clicked = await evaluate(`(() => {
        const button=[...document.querySelectorAll('.abags-fidelity3d-view-controls button')]
          .find((node)=>node.textContent?.trim()===${JSON.stringify(label)});
        if(!button)return false;
        button.click();
        return true;
      })()`);
      if (!clicked) throw new Error(`Could not select 3D view ${label}.`);
      await waitFor(`(() => {
        const stage=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-bag-builder-stage');
        const active=[...document.querySelectorAll('.abags-fidelity3d-view-controls button')]
          .find((node)=>node.getAttribute('aria-pressed')==='true')?.textContent?.trim();
        if(!stage || active!==${JSON.stringify(label)})return false;
        const x=Number(stage.dataset.abagsFidelity3dRotationX);
        const y=Number(stage.dataset.abagsFidelity3dRotationY);
        return Number.isFinite(x) && Number.isFinite(y) &&
          Math.abs(x-${expected.x})<0.001 && Math.abs(y-${expected.y})<0.001;
      })()`, `${label} authoritative Fidelity3D transform`);
      await sleep(260);
    };

    const measureAnchors = async () => evaluate(`(() => {
      const stage=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-bag-builder-stage');
      const web=stage?.querySelector('.abags-fidelity3d-canvas');
      const back=stage?.querySelector('.abags-accessory-fidelity-back');
      const front=stage?.querySelector('.abags-accessory-fidelity-front');
      if(!(stage instanceof HTMLElement) || !(web instanceof HTMLCanvasElement) ||
        !(back instanceof HTMLCanvasElement) || !(front instanceof HTMLCanvasElement))return null;
      const gl=web.getContext('webgl');
      const backCtx=back.getContext('2d');
      const frontCtx=front.getContext('2d');
      if(!gl || gl.isContextLost() || !backCtx || !frontCtx)return null;
      const gw=gl.drawingBufferWidth, gh=gl.drawingBufferHeight;
      if(gw<16 || gh<16 || back.width<16 || back.height<16 || front.width<16 || front.height<16)return null;
      const webPixels=new Uint8Array(gw*gh*4);
      gl.readPixels(0,0,gw,gh,gl.RGBA,gl.UNSIGNED_BYTE,webPixels);
      if(gl.getError()!==gl.NO_ERROR)return null;

      let minX=gw, maxX=-1, minY=gh, maxY=-1, webOpaque=0;
      for(let yTop=0;yTop<gh;yTop++){
        const gy=gh-1-yTop;
        for(let x=0;x<gw;x++){
          const alpha=webPixels[(gy*gw+x)*4+3];
          if(alpha<=24)continue;
          webOpaque++;
          if(x<minX)minX=x;
          if(x>maxX)maxX=x;
          if(yTop<minY)minY=yTop;
          if(yTop>maxY)maxY=yTop;
        }
      }
      if(!webOpaque || maxX<minX || maxY<minY)return null;
      const bodyCenterX=(minX+maxX)/2;
      const bodyWidth=Math.max(1,maxX-minX+1);

      const nearWeb=(gx,gyTop,radius)=>{
        const x0=Math.max(0,gx-radius), x1=Math.min(gw-1,gx+radius);
        const y0=Math.max(0,gyTop-radius), y1=Math.min(gh-1,gyTop+radius);
        for(let y=y0;y<=y1;y++){
          const glY=gh-1-y;
          for(let x=x0;x<=x1;x++){
            if(webPixels[(glY*gw+x)*4+3]>24)return true;
          }
        }
        return false;
      };

      const overlayMetrics=(canvas,ctx)=>{
        const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
        const radius=Math.max(2,Math.round(4*gw/Math.max(1,stage.getBoundingClientRect().width)));
        let opaque=0,near=0,away=0,leftAttachment=0,rightAttachment=0;
        let hash=2166136261>>>0;
        for(let y=0;y<canvas.height;y++){
          for(let x=0;x<canvas.width;x++){
            const i=(y*canvas.width+x)*4;
            const a=pixels[i+3];
            if(a<=24)continue;
            opaque++;
            const gx=Math.max(0,Math.min(gw-1,Math.round((x/Math.max(1,canvas.width-1))*(gw-1))));
            const gyTop=Math.max(0,Math.min(gh-1,Math.round((y/Math.max(1,canvas.height-1))*(gh-1))));
            const attached=nearWeb(gx,gyTop,radius);
            if(attached){
              near++;
              if(gx<bodyCenterX-bodyWidth*0.18)leftAttachment++;
              if(gx>bodyCenterX+bodyWidth*0.18)rightAttachment++;
            }else away++;
            hash^=pixels[i]; hash=Math.imul(hash,16777619)>>>0;
            hash^=pixels[i+1]; hash=Math.imul(hash,16777619)>>>0;
            hash^=pixels[i+2]; hash=Math.imul(hash,16777619)>>>0;
            hash^=a; hash=Math.imul(hash,16777619)>>>0;
            hash^=(x&255); hash=Math.imul(hash,16777619)>>>0;
            hash^=(y&255); hash=Math.imul(hash,16777619)>>>0;
          }
        }
        return {opaque,nearWebgl:near,awayFromWebgl:away,leftAttachment,rightAttachment,hash:hash.toString(16).padStart(8,'0')};
      };

      return {
        family:stage.dataset.family||'',
        strap:stage.dataset.strap||'',
        flap:stage.dataset.flap||'',
        accent:stage.dataset.accent||'',
        rotation:{
          x:Number(stage.dataset.abagsFidelity3dRotationX),
          y:Number(stage.dataset.abagsFidelity3dRotationY),
          zoom:Number(stage.dataset.abagsFidelity3dZoom),
        },
        webgl:{opaque:webOpaque,bounds:{minX,maxX,minY,maxY}},
        back:overlayMetrics(back,backCtx),
        front:overlayMetrics(front,frontCtx),
      };
    })()`);

    const capture = async (name) => {
      const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
      await writeFile(path.join(qaDir, name), Buffer.from(shot.data, "base64"));
    };

    const assertAnchored = (label, view, metrics) => {
      if (!metrics || metrics.family !== "mini" || metrics.strap === "none" || metrics.flap === "none" || metrics.accent === "none") {
        throw new Error(`${label} ${view}: incomplete accessory configuration: ${JSON.stringify(metrics)}`);
      }
      if (metrics.webgl.opaque < 500) throw new Error(`${label} ${view}: WebGL body is unexpectedly empty: ${JSON.stringify(metrics)}`);
      if (metrics.back.opaque < 80 || metrics.back.nearWebgl < 4 || metrics.back.awayFromWebgl < 20) {
        throw new Error(`${label} ${view}: strap/chain does not both attach to and extend away from the WebGL body: ${JSON.stringify(metrics)}`);
      }
      if (view !== "Bok" && (metrics.back.leftAttachment < 2 || metrics.back.rightAttachment < 2)) {
        throw new Error(`${label} ${view}: strap/chain is not attached on both visible side zones: ${JSON.stringify(metrics)}`);
      }
      if (metrics.front.opaque < 80 || metrics.front.nearWebgl < 8) {
        throw new Error(`${label} ${view}: flap/accent front layer is detached from the WebGL body: ${JSON.stringify(metrics)}`);
      }
    };

    const buildScenario = async ({ label, viewport, choices }) => {
      await send("Emulation.setDeviceMetricsOverride", viewport);
      await send("Emulation.setTouchEmulationEnabled", viewport.mobile
        ? { enabled: true, maxTouchPoints: 5 }
        : { enabled: false });
      await clearAndReload();
      await openBuilder();
      for (const [key,value] of choices) await choose(key,value);
      await waitReady(`${label} final accessory configuration`);

      const views = [];
      for (const view of ["3/4", "Przód", "Bok"]) {
        await clickView(view);
        const metrics = await measureAnchors();
        assertAnchored(label, view, metrics);
        await capture(`anchors-${label.toLowerCase()}-${view === "3/4" ? "three" : view === "Przód" ? "front" : "side"}.png`);
        views.push({ view, metrics });
      }

      await clickView("3/4");
      const restored = await measureAnchors();
      assertAnchored(label, "3/4 restored", restored);
      const originalThree = views[0].metrics;
      if (restored.back.hash !== originalThree.back.hash || restored.front.hash !== originalThree.front.hash) {
        throw new Error(`${label}: accessory overlays drift after Przód/Bok round-trip: ${JSON.stringify({ originalThree, restored })}`);
      }
      if (new Set(views.map((item)=>item.metrics.back.hash)).size !== 3 || new Set(views.map((item)=>item.metrics.front.hash)).size !== 3) {
        throw new Error(`${label}: accessory layers do not redraw distinctly for Przód / 3/4 / Bok: ${JSON.stringify(views)}`);
      }
      return views;
    };

    await send("Runtime.enable");
    await send("Page.enable");
    await waitFor("document.readyState === 'complete'", "initial load");

    const desktop = await buildScenario({
      label: "Desktop",
      viewport: { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
      choices: [
        ["family", "mini"], ["color", "#E4A9B5"], ["stitch", "herringbone"], ["flap", "crochet"],
        ["handles", "wood-light"], ["strap", "woven"], ["hardware", "silver"], ["accent", "tassel"],
      ],
    });

    const mobile = await buildScenario({
      label: "Mobile",
      viewport: { width: 390, height: 844, deviceScaleFactor: 2, mobile: true },
      choices: [
        ["family", "mini"], ["color", "#087E81"], ["stitch", "basket"], ["flap", "crochet"],
        ["handles", "wood-light"], ["strap", "chain"], ["hardware", "black"], ["accent", "charm"],
      ],
    });

    const summarize = (views) => Object.fromEntries(views.map(({ view, metrics }) => [view, {
      backHash: metrics.back.hash,
      frontHash: metrics.front.hash,
      backNear: metrics.back.nearWebgl,
      backAway: metrics.back.awayFromWebgl,
      frontNear: metrics.front.nearWebgl,
    }]));

    console.log("VIEW ANCHOR FIDELITY PASS:", productionUrl);
    console.log("- Przód / 3/4 / Bok use the authoritative Fidelity3D transform presets: yes");
    console.log("- back strap/chain pixels meet WebGL body/ring zones and also extend outside the body: yes");
    console.log("- front flap/accent pixels remain attached to the WebGL body: yes");
    console.log("- both accessory canvases redraw distinctly per view and return deterministically to 3/4: yes");
    console.log("- desktop view anchors:", summarize(desktop));
    console.log("- mobile view anchors:", summarize(mobile));
  } finally {
    try { socket?.close(); } catch {}
    chrome.kill("SIGTERM");
    await sleep(200);
    if (!chrome.killed) chrome.kill("SIGKILL");
  }
}

main().catch((error) => {
  console.error("View anchor fidelity production acceptance failed:", error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
