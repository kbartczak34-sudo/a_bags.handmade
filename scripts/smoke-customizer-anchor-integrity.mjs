import { spawn, spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const productionUrl = process.env.ABAGS_PRODUCTION_URL || "https://abagshandmade.pl";
const port = Number(process.env.ABAGS_ANCHOR_CHROME_DEBUG_PORT || 9786);
const qaDir = process.env.ABAGS_REALTIME_QA_DIR || "artifacts/customizer-view-anchors";
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
  if (result?.exceptionDetails) {
    const description = result.exceptionDetails.exception?.description || result.exceptionDetails.text || "Runtime evaluation failed.";
    throw new Error(description);
  }
  return result?.result?.value;
}

function assertViewEvidence(label, view, evidence) {
  if (!evidence?.back || !evidence?.front) throw new Error(`${label} ${view}: missing accessory depth evidence.`);
  const { webgl, back, front } = evidence;
  if (back.width !== webgl.width || back.height !== webgl.height || front.width !== webgl.width || front.height !== webgl.height) {
    throw new Error(`${label} ${view}: accessory canvases do not share the verified WebGL pixel grid: ${JSON.stringify(evidence)}`);
  }
  if (back.sampled < 300 || back.contact < 55 || back.contactRatio < 0.08 || back.bottomContact < 50 || back.bottomContactRatio < 0.35) {
    throw new Error(`${label} ${view}: rear strap/chain no longer meets the WebGL body at its calibrated anchors: ${JSON.stringify(back)}`);
  }
  if (front.sampled < 150 || front.contact < 100 || front.contactRatio < 0.45) {
    throw new Error(`${label} ${view}: front flap/accent layer drifted away from the verified WebGL body: ${JSON.stringify(front)}`);
  }
  if (view === "Bok") {
  const handle = evidence?.handle;
  if (!handle || handle.sampled < 120 || handle.clusterCount < 2 || handle.separationRatio < 0.045) {
    throw new Error(`${label} ${view}: rigid wooden handle lost front/back depth separation: ${JSON.stringify(handle)}`);
  }
  const [primary, secondary] = handle.clusters || [];
  if (!primary || !secondary || primary.pixels < 45 || secondary.pixels < 45) {
    throw new Error(`${label} ${view}: rigid wooden handle no longer produces two substantial side-view WebGL clusters: ${JSON.stringify(handle)}`);
  }
}
if (view !== "Bok") {
    if (back.leftContact < 20 || back.rightContact < 20) {
      throw new Error(`${label} ${view}: rear accessory lost one of its two side attachment zones: ${JSON.stringify(back)}`);
    }
    if (front.leftContact < 20 || front.rightContact < 20) {
      throw new Error(`${label} ${view}: front accessory no longer spans both calibrated body zones: ${JSON.stringify(front)}`);
    }
  }
}

async function main() {
  const binary = chromeBinary();
  const url = `${productionUrl}${productionUrl.includes("?") ? "&" : "?"}abags-anchor-integrity=${Date.now()}`;
  await mkdir(qaDir, { recursive: true });
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
    const evaluate = async (expression) => valueOf(await send("Runtime.evaluate", {
      expression, awaitPromise: true, returnByValue: true, userGesture: true,
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

    const setViewport = async (viewport) => {
      await send("Emulation.setDeviceMetricsOverride", viewport);
      await send("Emulation.setTouchEmulationEnabled", viewport.mobile ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
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
      await waitFor("document.querySelectorAll('.abags-vc-dialog.abags-reference-layout-v4 .abags-accessory-fidelity-canvas').length===2", "two accessory depth canvases");
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
      await waitFor(`(() => {
        const stage=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-bag-builder-stage');
        return stage?.dataset.abagsFinal3d==='ready' &&
          stage.dataset.abagsFinal3dSignature===stage.dataset.builderSignature &&
          stage.dataset.abagsFidelity3dFrame===stage.dataset.builderSignature &&
          !stage.dataset.abagsFidelity3dError;
      })()`, `${key}=${value} verified realtime composition`, 20_000);
      await sleep(160);
    };

    const clickView = async (label) => {
      const expected = label === "Przód" ? [-0.02, 0] : label === "Bok" ? [-0.035, Math.PI / 2] : [-0.07, 0.46];
      const clicked = await evaluate(`(() => {
        const button=[...document.querySelectorAll('.abags-fidelity3d-view-controls button')]
          .find((node)=>node.textContent?.trim()===${JSON.stringify(label)});
        if(!button)return false;
        button.click();
        return true;
      })()`);
      if (!clicked) throw new Error(`Could not select 3D view ${label}.`);
      await waitFor(`(() => {
        const stage=document.querySelector('.abags-bag-builder-stage');
        const button=[...document.querySelectorAll('.abags-fidelity3d-view-controls button')]
          .find((node)=>node.textContent?.trim()===${JSON.stringify(label)});
        const x=Number(stage?.dataset.abagsFidelity3dRotationX);
        const y=Number(stage?.dataset.abagsFidelity3dRotationY);
        return button?.getAttribute('aria-pressed')==='true' &&
          Math.abs(x-(${expected[0]}))<0.002 && Math.abs(y-(${expected[1]}))<0.002;
      })()`, `${label} authoritative transform`);
      await sleep(180);
    };

    const anchorEvidence = async () => evaluate(`(() => {
      const stage=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-bag-builder-stage');
      const canvas=stage?.querySelector('.abags-fidelity3d-canvas');
      const back=stage?.querySelector('.abags-accessory-fidelity-back');
      const front=stage?.querySelector('.abags-accessory-fidelity-front');
      if(!(canvas instanceof HTMLCanvasElement) || !(back instanceof HTMLCanvasElement) || !(front instanceof HTMLCanvasElement))return null;
      const gl=canvas.getContext('webgl');
      if(!gl || gl.isContextLost())return null;
      const gw=gl.drawingBufferWidth, gh=gl.drawingBufferHeight;
      if(gw<16 || gh<16)return null;
      const glPixels=new Uint8Array(gw*gh*4);
      gl.readPixels(0,0,gw,gh,gl.RGBA,gl.UNSIGNED_BYTE,glPixels);
      if(gl.getError()!==gl.NO_ERROR)return null;

      const analyzeRigidHandle=()=>{
  const columns=new Uint32Array(gw);
  let sampled=0;
  for(let y=0;y<gh;y+=1){
    for(let x=0;x<gw;x+=1){
      const i=(y*gw+x)*4;
      const r=glPixels[i],g=glPixels[i+1],b=glPixels[i+2],a=glPixels[i+3];
      const wood=a>32 && r>110 && g>75 && b<190 && r>g && g>b && r-b>32 && g-b>8;
      if(!wood)continue;
      columns[x]+=1;
      sampled+=1;
    }
  }
  const minColumn=Math.max(2,Math.round(gh*0.003));
  const gapTolerance=Math.max(2,Math.round(gw*0.006));
  const groups=[];
  let current=null,lastX=-1;
  for(let x=0;x<gw;x+=1){
    const pixels=columns[x];
    if(pixels<minColumn)continue;
    if(!current || x-lastX>gapTolerance){
      current={minX:x,maxX:x,pixels:0,weightedX:0};
      groups.push(current);
    }
    current.maxX=x;
    current.pixels+=pixels;
    current.weightedX+=x*pixels;
    lastX=x;
  }
  const minPixels=Math.max(28,Math.round(gh*0.035));
  const clusters=groups
    .filter((group)=>group.pixels>=minPixels)
    .map((group)=>({
      minX:group.minX,maxX:group.maxX,pixels:group.pixels,
      center:group.weightedX/Math.max(1,group.pixels),
    }))
    .sort((a,b)=>b.pixels-a.pixels);
  if(clusters.length<2){
    return {sampled,clusterCount:clusters.length,clusters:clusters.slice(0,4),separation:0,separationRatio:0};
  }
  const separation=Math.abs(clusters[0].center-clusters[1].center);
  return {
    sampled,clusterCount:clusters.length,clusters:clusters.slice(0,4),
    separation,separationRatio:separation/gw,
  };
};

const analyze=(overlay)=>{
        const ctx=overlay.getContext('2d');
        if(!ctx || overlay.width<16 || overlay.height<16)return null;
        const ow=overlay.width, oh=overlay.height;
        const pixels=ctx.getImageData(0,0,ow,oh).data;
        const samples=[];
        let minX=ow,minY=oh,maxX=0,maxY=0,hash=2166136261>>>0;
        for(let y=0;y<oh;y+=2){
          for(let x=0;x<ow;x+=2){
            const i=(y*ow+x)*4;
            const a=pixels[i+3];
            if(a<=24)continue;
            samples.push([x,y]);
            minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
            hash^=pixels[i];hash=Math.imul(hash,16777619)>>>0;
            hash^=pixels[i+1];hash=Math.imul(hash,16777619)>>>0;
            hash^=pixels[i+2];hash=Math.imul(hash,16777619)>>>0;
            hash^=a;hash=Math.imul(hash,16777619)>>>0;
          }
        }
        if(!samples.length)return {sampled:0,hash:'00000000'};
        const radius=Math.max(3,Math.round(Math.min(gw,gh)*0.022));
        const hasWebglNear=(ox,oy)=>{
          const wx=Math.max(0,Math.min(gw-1,Math.round(((ox+0.5)/ow)*gw)));
          const wyTop=Math.max(0,Math.min(gh-1,Math.round(((oy+0.5)/oh)*gh)));
          for(let dy=-radius;dy<=radius;dy+=1){
            const topY=wyTop+dy;
            if(topY<0||topY>=gh)continue;
            const gy=gh-1-topY;
            for(let dx=-radius;dx<=radius;dx+=1){
              if(dx*dx+dy*dy>radius*radius)continue;
              const gx=wx+dx;
              if(gx<0||gx>=gw)continue;
              if(glPixels[(gy*gw+gx)*4+3]>24)return true;
            }
          }
          return false;
        };
        const bottomCut=minY+(maxY-minY)*0.55;
        const midX=(minX+maxX)/2;
        let contact=0,bottom=0,bottomContact=0,leftContact=0,rightContact=0;
        for(const [x,y] of samples){
          const hit=hasWebglNear(x,y);
          if(hit){contact+=1;if(x<midX)leftContact+=1;else rightContact+=1;}
          if(y>=bottomCut){bottom+=1;if(hit)bottomContact+=1;}
        }
        return {
          width:ow,height:oh,bounds:{minX,minY,maxX,maxY},radius,sampled:samples.length,
          contact,bottom,bottomContact,leftContact,rightContact,
          contactRatio:contact/samples.length,bottomContactRatio:bottom?bottomContact/bottom:0,
          hash:hash.toString(16).padStart(8,'0'),
        };
      };

      return {
        view:[...stage.querySelectorAll('.abags-fidelity3d-view-controls button')]
          .find((button)=>button.getAttribute('aria-pressed')==='true')?.textContent?.trim()||'',
        rotationX:Number(stage.dataset.abagsFidelity3dRotationX),
        rotationY:Number(stage.dataset.abagsFidelity3dRotationY),
        zoom:Number(stage.dataset.abagsFidelity3dZoom),
        webgl:{width:gw,height:gh},
        handle:analyzeRigidHandle(),
        back:analyze(back),
        front:analyze(front),
      };
    })()`);

    const capture = async (name) => {
      const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
      await writeFile(path.join(qaDir, name), Buffer.from(shot.data, "base64"));
    };

    const runScenario = async ({ label, viewport, choices }) => {
      await setViewport(viewport);
      await clearAndReload();
      await openBuilder();
      for (const [key, value] of choices) await choose(key, value);
      const results = [];
      for (const view of ["Przód", "3/4", "Bok"]) {
        await clickView(view);
        const evidence = await anchorEvidence();
        assertViewEvidence(label, view, evidence);
        results.push(evidence);
        await capture(`anchor-${label.toLowerCase()}-${view === "Przód" ? "front" : view === "Bok" ? "side" : "three-quarter"}.png`);
      }
      if (new Set(results.map((item) => item.back.hash)).size !== 3) {
        throw new Error(`${label}: rear accessory canvas did not redraw uniquely for Przód / 3/4 / Bok: ${JSON.stringify(results.map((item) => item.back.hash))}`);
      }
      if (new Set(results.map((item) => item.front.hash)).size !== 3) {
        throw new Error(`${label}: front accessory canvas did not redraw uniquely for Przód / 3/4 / Bok: ${JSON.stringify(results.map((item) => item.front.hash))}`);
      }
      return results;
    };

    await send("Runtime.enable");
    await send("Page.enable");
    await waitFor("document.readyState === 'complete'", "initial load");

    const desktop = await runScenario({
      label: "Desktop",
      viewport: { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
      choices: [
        ["family", "mini"], ["color", "#E4A9B5"], ["stitch", "herringbone"], ["flap", "crochet"],
        ["handles", "wood-light"], ["strap", "woven"], ["hardware", "silver"], ["accent", "tassel"],
      ],
    });
    const mobile = await runScenario({
      label: "Mobile",
      viewport: { width: 390, height: 844, deviceScaleFactor: 2, mobile: true },
      choices: [
        ["family", "mini"], ["color", "#087E81"], ["stitch", "basket"], ["flap", "crochet"],
        ["handles", "wood-light"], ["strap", "chain"], ["hardware", "black"], ["accent", "charm"],
      ],
    });

    console.log("ACCESSORY ANCHOR INTEGRITY PASS:", productionUrl);
    console.log("- Przód / 3/4 / Bok use the authoritative Fidelity3D transform: yes");
    console.log("- rear strap/chain remains attached to WebGL side hardware on desktop/mobile: yes");
    console.log("- front flap/accent remains attached to the WebGL body on desktop/mobile: yes");
    console.log("- both accessory depth canvases redraw uniquely for all three views: yes");
  console.log("- rigid wood handle retains two side-view WebGL depth clusters on desktop/mobile: yes");
  console.log("- desktop side handle evidence:", desktop.find((item) => item.view === "Bok")?.handle);
  console.log("- mobile side handle evidence:", mobile.find((item) => item.view === "Bok")?.handle);
    console.log("- desktop evidence:", desktop.map((item) => ({ view:item.view, back:item.back.contactRatio, front:item.front.contactRatio })));
    console.log("- mobile evidence:", mobile.map((item) => ({ view:item.view, back:item.back.contactRatio, front:item.front.contactRatio })));
  } finally {
    try { socket?.close(); } catch {}
    chrome.kill("SIGTERM");
    await sleep(200);
    if (!chrome.killed) chrome.kill("SIGKILL");
  }
}

main().catch((error) => {
  console.error("Customizer accessory-anchor integrity failed:", error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
