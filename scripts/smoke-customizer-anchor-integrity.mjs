import { spawn, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { reloadCdpDocument } from "./cdp-document-reload.mjs";

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
    if (message.error) waiter.reject(new Error(`${waiter.method}: ${message.error.message || "CDP error"}`));
    else waiter.resolve(message.result);
  });

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const messageId = ++id;
    // SwiftShader can block a restored model's first draw/readPixels while it
    // finishes GPU work. This is a protocol budget, not a visual assertion:
    // readiness deadlines and all framebuffer/contact checks remain unchanged.
    const commandTimeoutMs = method === "Emulation.setDeviceMetricsOverride" || method === "Runtime.evaluate" ? 25_000 : cdpTimeoutMs;
    const timer = setTimeout(() => {
      pending.delete(messageId);
      const detail = method === "Runtime.evaluate" ? ` [${String(params.expression).trim().replace(/\s+/g, " ").slice(0, 160)}]` : "";
      reject(new Error(`CDP command timed out: ${method}${detail}`));
    }, commandTimeoutMs);
    pending.set(messageId, { resolve, reject, timer, method });
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

function assertRearAccessory(label, view, evidence) {
  const back = evidence?.back;
  if (!back) throw new Error(`${label} ${view}: missing rear accessory evidence.`);
  if (evidence.strapOwner === "webgl-band" && (evidence.duplicateStrap || evidence.strapTriangles < 100)) {
    throw new Error(`${label} ${view}: the shoulder band must have one verified volumetric renderer.`);
  }
  const minimumBackSamples = view === "Bok" ? 150 : 300;
  if (back.sampled < minimumBackSamples || back.contact < 55 || back.contactRatio < 0.08 || back.bottomContact < 50 || back.bottomContactRatio < 0.35) {
    throw new Error(`${label} ${view}: rear strap/chain no longer meets the WebGL body at its calibrated anchors: ${JSON.stringify(back)}`);
  }
  if (view !== "Bok" && (back.leftContact < 20 || back.rightContact < 20)) {
    throw new Error(`${label} ${view}: rear accessory lost one of its two side attachment zones: ${JSON.stringify(back)}`);
  }
}

function assertViewEvidence(label, view, evidence, frontEvidence) {
  if (!evidence?.back || !evidence?.front) throw new Error(`${label} ${view}: missing accessory depth evidence.`);
  const { webgl, back, front } = evidence;
  assertRearAccessory(label, view, evidence);
  if(evidence.rimTriangles<1000||!evidence.ground||evidence.ground.opacity<.05||evidence.ground.display==='none'||Math.abs(evidence.ground.top-evidence.ground.pixelBottom)>5){
    throw new Error(`${label} ${view}: braided mouth and customer-visible ground contact must follow the rendered bag: ${JSON.stringify(evidence.ground)}`);
  }
  if (evidence.ornamentOwner === "webgl" && (evidence.duplicateOrnament || evidence.ornamentTriangles < 100 || evidence.ornamentConstruction !== 'folded-fabric-gravity-fringe-v3')) {
    throw new Error(`${label} ${view}: the selected ornament must have one volumetric renderer.`);
  }
  if (evidence.legacyChainCount !== 0) {
    throw new Error(`${label} ${view}: a second legacy chain renderer is still mounted.`);
  }
  if (evidence.overlayCanvases?.length !== 4 || evidence.overlayCanvases.some((canvas) => canvas.width !== webgl.width || canvas.height !== webgl.height)) {
    throw new Error(`${label} ${view}: all four accessory canvases must share the WebGL pixel grid: ${JSON.stringify(evidence.overlayCanvases)}`);
  }
  if (evidence.overlayCanvases.some((canvas) => !canvas.visible)) {
    throw new Error(`${label} ${view}: accessory canvases are painted but hidden from the customer: ${JSON.stringify(evidence.overlayCanvases)}`);
  }
  if (back.width !== webgl.width || back.height !== webgl.height || front.width !== webgl.width || front.height !== webgl.height) {
    throw new Error(`${label} ${view}: accessory canvases do not share the verified WebGL pixel grid: ${JSON.stringify(evidence)}`);
  }
  // The compact shoulder arc is foreshortened edge-on in Bok. Its smaller
  // raster must still meet every attachment/contact requirement below.
  // Edge-on flaps and tassels collapse to a narrow but fully attached raster.
  // Preserve the contact floor and ratio; only the sample-area floor scales
  // for the genuine side view (e.g. 143/143 contact pixels on desktop Bok).
  // Real 3D beads overlap and foreshorten at the side. Their samples below are
  // the actual WebGL difference against the same bag with its ornament removed.
  const minimumFrontSamples = evidence.ornamentOwner === "webgl" ? 12 : view === "Bok" ? 120 : 150;
  const minimumFrontContact = evidence.ornamentOwner === "webgl" ? Math.min(100, Math.ceil(front.sampled * .6)) : 100;
  // The preset side faces away from right-mounted ornaments. A real depth
  // buffer can hide them completely; the opposite side is tested separately
  // with a customer pointer drag and must reveal the same ornament again.
  const farSideOcclusion = evidence.ornamentOwner === "webgl" && view === "Bok" && front.sampled < 12
    && frontEvidence?.appearance?.changed >= 12 && evidence.appearance;
  if (!farSideOcclusion && (front.sampled < minimumFrontSamples || front.contact < minimumFrontContact || front.contactRatio < 0.45)) {
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
    const handle = evidence?.handle;
    if (!handle || (view === "Przód" && handle.sampled < 1000)) {
      throw new Error(`${label} ${view}: rigid wooden handles are missing or too small: ${JSON.stringify(handle)}`);
    }
    if (view === "Przód" && handle.clusterCount !== 1) {
      throw new Error(`${label} ${view}: the front-on wooden rings must read as one coherent arch: ${JSON.stringify(handle)}`);
    }
    if (view === "3/4") {
      // Ring silhouettes shrink with yaw. Compare to this device's verified
      // front frame, rather than applying the same absolute pixel floor at
      // every angle. Retain 90% of the expected foreshortened area.
      const frontHandle = frontEvidence?.handle;
      if (!frontHandle) throw new Error(`${label}: missing front handle reference.`);
      const yaw = evidence.rotationY - frontEvidence.rotationY;
      const expectedArea = frontHandle.sampled * Math.max(0.25, Math.abs(Math.cos(yaw)));
      if (handle.sampled < expectedArea * 0.9) {
        throw new Error(`${label} ${view}: wooden handle lost projected area relative to front view: ${JSON.stringify({ handle, expectedArea })}`);
      }
      // Two real rings may produce a small second rear arc in an oblique view.
      // Reject a substantial disconnected bar, not a physically correct
      // glimpse of the back handle. The true side view still requires 2 rings.
      if (handle.clusterCount < 1 || handle.clusterCount > 2) {
        throw new Error(`${label} ${view}: implausible number of visible wooden handle arcs: ${JSON.stringify(handle)}`);
      }
      if (handle.clusterCount === 2) {
        const [major, minor] = [...handle.clusters].sort((a, b) => b.pixels - a.pixels);
        // One-pixel edge classification has a perimeter-sized error, which
        // matters for a small phone raster. Keep the 18% rear-arc limit with
        // sqrt(area) pixels of boundary tolerance and a dominant front arch.
        const rasterTolerance = Math.ceil(Math.sqrt(handle.sampled));
        if (major.pixels < expectedArea * 0.75 || minor.pixels > handle.sampled * 0.18 + rasterTolerance || handle.separationRatio > 0.12) {
          throw new Error(`${label} ${view}: rear handle reads as a detached large object instead of partial occlusion: ${JSON.stringify(handle)}`);
        }
      }
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
  const chromeProfile = await mkdtemp(path.join(tmpdir(), "abags-anchor-chrome-"));
  const chrome = spawn(binary, [
    "--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--disable-background-networking",
    "--disable-default-apps", "--no-first-run", "--use-gl=swiftshader", "--enable-unsafe-swiftshader",
    `--user-data-dir=${chromeProfile}`, `--remote-debugging-port=${port}`, "about:blank",
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

    let mobileViewport = false;
    const setViewport = async (viewport) => {
      mobileViewport = Boolean(viewport.mobile);
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
      await reloadCdpDocument(send, evaluate);
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
      await waitFor(`Boolean(document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-vc-preview .abags-bag-builder-stage[data-abags-live-stage="true"]'))`, "customer realtime stage");
      await waitFor("document.querySelectorAll('.abags-vc-dialog.abags-reference-layout-v4 .abags-accessory-fidelity-canvas').length===2", "two accessory depth canvases");
      await waitFor("Boolean(document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-vc-preview .abags-bag-builder-stage[data-abags-live-stage=\"true\"] .abags-accessory-material-finish-back'))", "projected strap accessory canvas");
    };

    const choose = async (key, value) => {
      const clicked = await evaluate(`(() => {
        const button=[...document.querySelectorAll('.abags-vc-dialog.abags-reference-layout-v4 .abags-builder-controls button[data-builder-key=${JSON.stringify(key)}]')]
          .find((node)=>node.dataset.builderValue===${JSON.stringify(value)});
        if(!button || button.disabled)return false;
        button.click();
        return true;
      })()`);
      if (!clicked) throw new Error(`Could not select ${key}=${value}.`);
      await waitFor(
        `document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-vc-preview .abags-bag-builder-stage[data-abags-live-stage="true"]')?.dataset[${JSON.stringify(key)}]===${JSON.stringify(value)}`,
        `${key}=${value}`,
      );
      await waitFor(`(() => {
        const stage=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-vc-preview .abags-bag-builder-stage[data-abags-live-stage="true"]');
        return stage?.dataset.abagsFinal3d==='ready' &&
          stage.dataset.abagsFinal3dSignature===stage.dataset.builderSignature &&
          stage.dataset.abagsFidelity3dFrame===stage.dataset.builderSignature &&
          !stage.dataset.abagsFidelity3dError && (() => {
            const print=JSON.parse(stage.dataset.abagsFidelityTextilePrint||'null');
            return print && (!print.scarfUrl||print.scarf) && (!print.strapUrl||print.strap);
          })();
      })()`, `${key}=${value} verified realtime composition`, 20_000);
      await sleep(160);
    };

    const clickView = async (label) => {
      const expected = label === "Przód" ? [-0.02, 0] : label === "Bok" ? [-0.07, Math.PI / 2] : [-0.12, -0.62];
      // Use a real positioned pointer event, not HTMLElement.click() at (0,0).
      // Fidelity3D's touch rescue and legacy hidden controls can otherwise make a
      // synthetic click report success without reaching the visible React control.
      const point = await evaluate(`(() => {
        const stage=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-vc-preview .abags-bag-builder-stage[data-abags-live-stage="true"]');
        const controls=[...(stage?.querySelectorAll('.abags-fidelity3d-layer .abags-fidelity3d-view-controls button, .abags-fidelity3d-layer .abags-pro3d-view-controls button')||[])];
        const button=controls.find((node)=>{
          if(node.textContent?.trim()!==${JSON.stringify(label)})return false;
          const r=node.getBoundingClientRect(), s=getComputedStyle(node);
          return r.width>10&&r.height>10&&s.display!=='none'&&s.visibility!=='hidden'&&Number.parseFloat(s.opacity||'1')>0.05;
        });
        if(!button)return null;
        const r=button.getBoundingClientRect();
        return {x:r.left+r.width/2,y:r.top+r.height/2};
      })()`);
      if (!point) throw new Error(`Could not locate visible Fidelity3D view ${label}.`);
      if (mobileViewport) {
        await send("Input.dispatchTouchEvent", {type:"touchStart",touchPoints:[{x:point.x,y:point.y,id:1}]});
        await send("Input.dispatchTouchEvent", {type:"touchEnd",touchPoints:[]});
      } else {
        await send("Input.dispatchMouseEvent", {type:"mouseMoved",x:point.x,y:point.y});
        await send("Input.dispatchMouseEvent", {type:"mousePressed",x:point.x,y:point.y,button:"left",clickCount:1});
        await send("Input.dispatchMouseEvent", {type:"mouseReleased",x:point.x,y:point.y,button:"left",clickCount:1});
      }
      await waitFor(`(() => {
        const stage=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-vc-preview .abags-bag-builder-stage[data-abags-live-stage="true"]');
        const button=[...(stage?.querySelectorAll('.abags-fidelity3d-layer .abags-fidelity3d-view-controls button, .abags-fidelity3d-layer .abags-pro3d-view-controls button')||[])]
          .find((node)=> {
            if(node.textContent?.trim()!==${JSON.stringify(label)})return false;
            const r=node.getBoundingClientRect(),s=getComputedStyle(node);
            return r.width>10&&r.height>10&&s.display!=='none'&&s.visibility!=='hidden';
          });
        const x=Number(stage?.dataset.abagsFidelity3dRotationX);
        const y=Number(stage?.dataset.abagsFidelity3dRotationY);
        return button?.getAttribute('aria-pressed')==='true' &&
          Math.abs(x-(${expected[0]}))<0.002 && Math.abs(y-(${expected[1]}))<0.002;
      })()`, `${label} authoritative transform`, 15_000);
      await sleep(180);
    };

    const anchorEvidence = async () => evaluate(`(() => {
      const stage=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-vc-preview .abags-bag-builder-stage[data-abags-live-stage="true"]');
      const canvas=stage?.querySelector('.abags-fidelity3d-canvas');
      const back=stage?.querySelector('.abags-accessory-material-finish-back');
      const front=stage?.querySelector('.abags-accessory-fidelity-front');
      if(!(canvas instanceof HTMLCanvasElement) || !(back instanceof HTMLCanvasElement) || !(front instanceof HTMLCanvasElement))return null;
      const gl=canvas.getContext('webgl');
      if(!gl || gl.isContextLost())return null;
      const gw=gl.drawingBufferWidth, gh=gl.drawingBufferHeight;
      if(gw<16 || gh<16)return null;
      const glPixels=new Uint8Array(gw*gh*4);
      gl.readPixels(0,0,gw,gh,gl.RGBA,gl.UNSIGNED_BYTE,glPixels);
      if(gl.getError()!==gl.NO_ERROR)return null;
      const ornamentInWebgl=stage.dataset.abagsFidelityOrnamentOwner==='webgl'&&stage.dataset.abagsFidelityAccessorySignature===stage.dataset.builderSignature;
      const stamp=[stage.dataset.family,stage.dataset.color,stage.dataset.stitch,stage.dataset.flap,stage.dataset.handles,stage.dataset.strap,stage.dataset.hardware,stage.dataset.abagsFidelity3dRotationX,stage.dataset.abagsFidelity3dRotationY,stage.dataset.abagsFidelity3dZoom].join('|');
      const baseline=canvas.__abagsOrnamentBaseline;
      const bodyPixels=baseline?.stamp===stamp&&baseline.pixels.length===glPixels.length?baseline.pixels:null;
      const strapInWebgl=stage.dataset.abagsFidelityStrapOwner==='webgl-band'&&stage.dataset.abagsFidelityAccessorySignature===stage.dataset.builderSignature;
      const strapStamp=[stage.dataset.family,stage.dataset.color,stage.dataset.stitch,stage.dataset.flap,stage.dataset.handles,stage.dataset.accent,stage.dataset.hardware,stage.dataset.abagsFidelity3dRotationX,stage.dataset.abagsFidelity3dRotationY,stage.dataset.abagsFidelity3dZoom].join('|');
      const strapBaseline=canvas.__abagsStrapBaseline;
      const strapBodyPixels=strapBaseline?.stamp===strapStamp&&strapBaseline.pixels.length===glPixels.length?strapBaseline.pixels:null;
      const strapPixels=new Uint8ClampedArray(glPixels.length);
      if(strapInWebgl&&strapBodyPixels)for(let i=0;i<glPixels.length;i+=4){
        if(glPixels[i+3]>24&&Math.abs(glPixels[i]-strapBodyPixels[i])+Math.abs(glPixels[i+1]-strapBodyPixels[i+1])+Math.abs(glPixels[i+2]-strapBodyPixels[i+2])>20){
          const topIndex=((gh-1-Math.floor(i/4/gw))*gw+(i/4)%gw)*4;
          strapPixels.set(glPixels.subarray(i,i+4),topIndex);
        }
      }
      const ornamentPixels=new Uint8ClampedArray(glPixels.length);
      if(ornamentInWebgl&&bodyPixels)for(let i=0;i<glPixels.length;i+=4){
        if(glPixels[i+3]>24&&Math.abs(glPixels[i]-bodyPixels[i])+Math.abs(glPixels[i+1]-bodyPixels[i+1])+Math.abs(glPixels[i+2]-bodyPixels[i+2])>20){
          const topIndex=((gh-1-Math.floor(i/4/gw))*gw+(i/4)%gw)*4;
          ornamentPixels.set(glPixels.subarray(i,i+4),topIndex);
        }
      }

      const ornamentContact=()=>{
        let point;
        try { point=JSON.parse(stage.dataset.abagsFidelityAccessoryAnchor||'null'); } catch { return null; }
        if(!Array.isArray(point)||point.length!==3||!point.every(Number.isFinite))return null;
        const current=stage.dataset.abagsFidelityAccessorySignature===stage.dataset.builderSignature;
        const yaw=Number(stage.dataset.abagsFidelity3dRotationY),pitch=Number(stage.dataset.abagsFidelity3dRotationX);
        const zoom=Number(stage.dataset.abagsFidelity3dZoom);
        let [x,y,z]=point.map(v=>v*zoom);
        [x,z]=[x*Math.cos(yaw)+z*Math.sin(yaw),-x*Math.sin(yaw)+z*Math.cos(yaw)];
        [y,z]=[y*Math.cos(pitch)-z*Math.sin(pitch),y*Math.sin(pitch)+z*Math.cos(pitch)];
        y-=.02;z-=5;
        const f=1/Math.tan(Math.PI/5.3/2);
        const px=Math.round((x*f/(gw/gh)/-z*.5+.5)*gw),py=Math.round((.5-y*f/-z*.5)*gh);
        const overlay=ornamentInWebgl?ornamentPixels:front.getContext('2d')?.getImageData(0,0,gw,gh).data;
        if(!overlay)return null;
        let wood=0,knot=0;
        const radius=Math.max(3,Math.round(Math.min(gw,gh)*.01));
        for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
          const sx=px+dx,sy=py+dy;
          if(sx<0||sx>=gw||sy<0||sy>=gh||dx*dx+dy*dy>radius*radius)continue;
          const i=((gh-1-sy)*gw+sx)*4;
          const [r,g,b,a]=(bodyPixels||glPixels).subarray(i,i+4);
          if(a>32&&r>110&&g>75&&b<190&&r>g&&g>b&&r-b>32&&g-b>8)wood++;
          if(overlay[(sy*gw+sx)*4+3]>24)knot++;
        }
        return {point,current,wood,knot};
      };

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

const analyze=(overlay,renderedPixels)=>{
        const ctx=overlay.getContext('2d');
        if(!ctx || overlay.width<16 || overlay.height<16)return null;
        const ow=overlay.width, oh=overlay.height;
        const pixels=renderedPixels||ctx.getImageData(0,0,ow,oh).data;
        const samples=[];
        let minX=ow,minY=oh,maxX=0,maxY=0,hash=2166136261>>>0;
        // Include the complete raster, including transparent pixels. Hashing
        // only colored samples discarded their positions, so moving the same
        // accessory could be mistaken for an unchanged camera frame.
        for(let index=0;index<pixels.length;index+=1){
          hash^=pixels[index];hash=Math.imul(hash,16777619)>>>0;
        }
        for(let y=0;y<oh;y+=2){
          for(let x=0;x<ow;x+=2){
            const i=(y*ow+x)*4;
            const a=pixels[i+3];
            if(a<=24)continue;
            samples.push([x,y]);
            minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
          }
        }
        if(!samples.length)return {width:ow,height:oh,sampled:0,contact:0,contactRatio:0,hash:'00000000'};
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
              const contactPixels=ornamentInWebgl&&overlay===front&&bodyPixels?bodyPixels:strapInWebgl&&overlay===back&&strapBodyPixels?strapBodyPixels:glPixels;
              if(contactPixels[(gy*gw+gx)*4+3]>24)return true;
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

      const layer=stage.querySelector('.abags-fidelity3d-layer'),shadow=getComputedStyle(layer,'::after'),rect=canvas.getBoundingClientRect();
      const top=shadow.top.endsWith('%')?parseFloat(shadow.top)/100*layer.getBoundingClientRect().height:parseFloat(shadow.top);
      let lowest=Infinity;
      for(let i=3;i<glPixels.length;i+=16)if(glPixels[i]>24)lowest=Math.min(lowest,Math.floor((i-3)/4/gw));
      return {
        rimTriangles:Number(stage.dataset.abagsFidelityRimTriangles||0),
        ground:{top,pixelBottom:(1-lowest/gh)*rect.height,opacity:Number(shadow.opacity),display:shadow.display},
        view:[...stage.querySelectorAll('.abags-pro3d-view-controls button')]
          .find((button)=>button.getAttribute('aria-pressed')==='true')?.textContent?.trim()||'',
        rotationX:Number(stage.dataset.abagsFidelity3dRotationX),
        rotationY:Number(stage.dataset.abagsFidelity3dRotationY),
        zoom:Number(stage.dataset.abagsFidelity3dZoom),
        webgl:{width:gw,height:gh},
        legacyChainCount:stage.querySelectorAll('.abags-chain-realism').length,
        ornamentOwner:ornamentInWebgl?'webgl':'canvas',
        ornamentTriangles:Number(stage.dataset.abagsFidelityOrnamentTriangles||0),
        ornamentConstruction:stage.dataset.abagsFidelityOrnamentConstruction||'',
        ornamentBounds:ornamentInWebgl?JSON.parse(stage.dataset.abagsFidelityOrnamentBounds||'null'):null,
        duplicateOrnament:ornamentInWebgl&&analyze(front).sampled>0,
        strapOwner:strapInWebgl?'webgl-band':'canvas',
        strapTriangles:Number(stage.dataset.abagsFidelityStrapTriangles||0),
        duplicateStrap:strapInWebgl&&analyze(back).sampled>0,
        overlayCanvases:[...stage.querySelectorAll('.abags-accessory-fidelity-back, .abags-accessory-fidelity-front, .abags-accessory-material-finish-back, .abags-accessory-material-finish-front')]
          .map((canvas)=>{
            let visible=canvas.isConnected;
            for(let node=canvas;node;node=node.parentElement){
              const style=getComputedStyle(node);
              if(style.display==='none'||style.visibility!=='visible'||Number(style.opacity)<.05)visible=false;
            }
            const rect=canvas.getBoundingClientRect();
            return {className:canvas.className,width:canvas.width,height:canvas.height,visible:visible&&rect.width>0&&rect.height>0};
          }),
        handle:analyzeRigidHandle(),
        ornament:ornamentContact(),
        back:analyze(back,strapInWebgl?strapPixels:null),
        front:analyze(front,ornamentInWebgl?ornamentPixels:null),
      };
    })()`);

    const capture = async (name) => {
      const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
      await writeFile(path.join(qaDir, name), Buffer.from(shot.data, "base64"));
    };

    // Compare real browser screenshots with the ornament visible and hidden.
    // Reading a canvas framebuffer alone cannot detect CSS or stacking masks.
    const verifyAccessoryAppearance = async (label, evidence, allowFarSideOcclusion = false, component = "accent") => {
      const state = await evaluate(`(() => {
        const canvas=document.querySelector(${JSON.stringify('.abags-vc-dialog.abags-reference-layout-v4 .abags-vc-preview '+(component==='strap'?'.abags-accessory-material-finish-back':'.abags-accessory-fidelity-front'))});
        if(!(canvas instanceof HTMLCanvasElement))return null;
        for(let node=canvas;node;node=node.parentElement){
          const style=getComputedStyle(node);
          if(style.display==='none'||style.visibility!=='visible'||Number(style.opacity)<.05)return null;
        }
        const rect=canvas.getBoundingClientRect();
        const stage=canvas.closest('.abags-bag-builder-stage');
        const owner=stage.dataset[${JSON.stringify(component==='strap'?'abagsFidelityStrapOwner':'abagsFidelityOrnamentOwner')}];
        let bounds=null;
        if(owner==='webgl'||owner==='webgl-band'){
          const box=JSON.parse(stage.dataset[${JSON.stringify(component==='strap'?'abagsFidelityStrapBounds':'abagsFidelityOrnamentBounds')}]||'null');
          if(!box)return null;
          const yaw=Number(stage.dataset.abagsFidelity3dRotationY),pitch=Number(stage.dataset.abagsFidelity3dRotationX),zoom=Number(stage.dataset.abagsFidelity3dZoom);
          const f=1/Math.tan(Math.PI/5.3/2),w=canvas.width,h=canvas.height;
          const points=[];
          for(const ax of [0,1])for(const ay of [0,1])for(const az of [0,1]){
            let [x,y,z]=[ax?box.max[0]:box.min[0],ay?box.max[1]:box.min[1],az?box.max[2]:box.min[2]].map(v=>v*zoom);
            [x,z]=[x*Math.cos(yaw)+z*Math.sin(yaw),-x*Math.sin(yaw)+z*Math.cos(yaw)];
            [y,z]=[y*Math.cos(pitch)-z*Math.sin(pitch),y*Math.sin(pitch)+z*Math.cos(pitch)];
            y-=.02;z-=5;
            points.push([(x*f/(w/h)/-z*.5+.5)*w,(.5-y*f/-z*.5)*h]);
          }
          bounds={minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minY:Math.min(...points.map(p=>p[1])),maxY:Math.max(...points.map(p=>p[1]))};
        }
        return {owner,value:stage.dataset[${JSON.stringify(component)}],bounds,style:canvas.getAttribute('style'),rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height}};
      })()`);
      const bounds = state?.bounds || evidence?.front?.bounds;
      if (!state || !bounds) throw new Error(`${label}: customer ornament layer is not visible.`);
      const rect = state.rect, grid = evidence.webgl;
      const x = Math.max(0, rect.x + (bounds.minX - 8) / grid.width * rect.width);
      const y = Math.max(0, rect.y + (bounds.minY - 8) / grid.height * rect.height);
      const clip = { x, y, width: Math.max(1, (bounds.maxX - bounds.minX + 16) / grid.width * rect.width), height: Math.max(1, (bounds.maxY - bounds.minY + 16) / grid.height * rect.height), scale: 1 };
      const screenshot = () => send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false, clip });
      const visible = await screenshot();
      let hidden;
      try {
        if(state.owner==='webgl'||state.owner==='webgl-band'){
          await choose(component,'none');
          await evaluate(`(() => {
            const stage=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-vc-preview .abags-bag-builder-stage[data-abags-live-stage="true"]');
            const canvas=stage.querySelector('.abags-fidelity3d-canvas'),gl=canvas.getContext('webgl');
            const pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
            gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
            if(gl.getError()!==gl.NO_ERROR)throw new Error('Cannot read the ornament-free reference');
            const stamp=[stage.dataset.family,stage.dataset.color,stage.dataset.stitch,stage.dataset.flap,stage.dataset.handles,stage.dataset[${JSON.stringify(component==='strap'?'accent':'strap')}],stage.dataset.hardware,stage.dataset.abagsFidelity3dRotationX,stage.dataset.abagsFidelity3dRotationY,stage.dataset.abagsFidelity3dZoom].join('|');
            if(${JSON.stringify(component)}==='strap'&&(Number(stage.dataset.abagsFidelityStrapTriangles)!==0||stage.dataset.abagsFidelityStrapBounds))throw new Error('Removed band left residual WebGL geometry');
            canvas[${JSON.stringify(component==='strap'?'__abagsStrapBaseline':'__abagsOrnamentBaseline')}]={stamp,pixels};
            return true;
          })()`);
        }else await evaluate(`(() => {
          document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-vc-preview .abags-accessory-fidelity-front').style.setProperty('visibility','hidden','important');
          return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))));
        })()`);
        hidden = await screenshot();
      } finally {
        if(state.owner==='webgl'||state.owner==='webgl-band')await choose(component,state.value);
        else await evaluate(`(() => {
          const canvas=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-vc-preview .abags-accessory-fidelity-front');
          const original=${JSON.stringify(state.style)};
          if(original===null)canvas.removeAttribute('style');else canvas.setAttribute('style',original);
          return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))));
        })()`);
      }
      const difference = await evaluate(`(async () => {
        const load=data=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Cannot decode accessory screenshot'));image.src='data:image/png;base64,'+data;});
        const [a,b]=await Promise.all([load(${JSON.stringify(visible.data)}),load(${JSON.stringify(hidden.data)})]);
        const canvas=document.createElement('canvas');canvas.width=a.naturalWidth;canvas.height=a.naturalHeight;
        const context=canvas.getContext('2d',{willReadFrequently:true});
        context.drawImage(a,0,0);const first=context.getImageData(0,0,canvas.width,canvas.height).data;
        context.clearRect(0,0,canvas.width,canvas.height);context.drawImage(b,0,0);const second=context.getImageData(0,0,canvas.width,canvas.height).data;
        let changed=0;for(let i=0;i<first.length;i+=4)if(Math.abs(first[i]-second[i])+Math.abs(first[i+1]-second[i+1])+Math.abs(first[i+2]-second[i+2])>20)changed++;
        return {changed,width:canvas.width,height:canvas.height};
      })()`);
      await writeFile(path.join(qaDir, `appearance-${label.replaceAll(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`), Buffer.from(visible.data, "base64"));
      if (difference.changed < 12 && !(allowFarSideOcclusion && state.owner==='webgl' && Math.abs(evidence.rotationY-Math.PI/2)<.002)) throw new Error(`${label}: selected ornament does not change the customer-visible image: ${JSON.stringify(difference)}`);
      return difference;
    };

    const runScenario = async ({ label, viewport, choices }) => {
      await setViewport(viewport);
      await clearAndReload();
      await openBuilder();
      for (const [key, value] of choices) await choose(key, value);
      const results = [];
      for (const view of ["Przód", "3/4", "Bok"]) {
        const before = await anchorEvidence();
        const expected = view === "Przód" ? [-0.02, 0] : view === "Bok" ? [-0.07, Math.PI / 2] : [-0.12, -0.62];
        const cameraChanged = !before || Math.abs(before.rotationX - expected[0]) >= 0.002
          || Math.abs(before.rotationY - expected[1]) >= 0.002;
        await clickView(view);
        let appearance, strapAppearance;
        const selected = await anchorEvidence();
        if(['woven','leather'].includes(choices.find(([key])=>key==='strap')?.[1])&&selected?.strapOwner!=='webgl-band')throw new Error(`${label}: flat shoulder strap did not reach the canonical renderer.`);
        if(selected?.strapOwner==='webgl-band')strapAppearance=await verifyAccessoryAppearance(`${label}-strap-${view}`,selected,false,'strap');
        if(selected?.ornamentOwner==='webgl')appearance=await verifyAccessoryAppearance(`${label}-${view}`,selected,view==='Bok');
        // The camera's React state can advance before the asynchronously composited
        // accessory canvases paint. Compare BOTH overlays with the pre-click raster,
        // including the first front view, which otherwise can retain the initial 3/4
        // pixels and falsely appear identical to the following actual 3/4 frame.
        const fresh = (value) => Boolean(value?.back && value?.front
          && Math.abs(value.rotationX - expected[0]) < 0.002
          && Math.abs(value.rotationY - expected[1]) < 0.002
          && (!cameraChanged || (value.back.hash !== before?.back?.hash && value.front.hash !== before?.front?.hash)));
        let sampled = await anchorEvidence();
        const deadline = Date.now() + 12_000;
        while (Date.now() < deadline && !fresh(sampled)) {
          await sleep(160);
          sampled = await anchorEvidence();
        }
        const evidence = { ...sampled, view, cameraChanged, appearance, strapAppearance, preClick: {
          rotationX:before?.rotationX,rotationY:before?.rotationY,
          backHash:before?.back?.hash,frontHash:before?.front?.hash,
        } };
        results.push(evidence);
        await writeFile(path.join(qaDir, `anchor-${label.toLowerCase()}-evidence.json`), JSON.stringify(results, null, 2));
        await capture(`anchor-${label.toLowerCase()}-${view === "Przód" ? "front" : view === "Bok" ? "side" : "three-quarter"}.png`);
        if (!fresh(sampled)) {
          throw new Error(`${label} ${view}: both accessory canvases did not redraw for the requested camera: ${JSON.stringify(evidence)}`);
        }
        assertViewEvidence(label, view, evidence, results[0]);
        evidence.appearance = appearance || await verifyAccessoryAppearance(`${label}-${view}`, evidence);
        await writeFile(path.join(qaDir, `anchor-${label.toLowerCase()}-evidence.json`), JSON.stringify(results, null, 2));
      }
      if (new Set(results.map((item) => item.back.hash)).size !== 3) {
        throw new Error(`${label}: rear accessory canvas did not redraw uniquely for Przód / 3/4 / Bok: ${JSON.stringify(results.map((item) => item.back.hash))}`);
      }
      if (new Set(results.map((item) => item.front.hash)).size !== 3) {
        throw new Error(`${label}: front accessory canvas did not redraw uniquely for Przód / 3/4 / Bok: ${JSON.stringify(results.map((item) => item.front.hash))}`);
      }
      if(results[0]?.ornamentOwner==='webgl'){
        await clickView('Przód');
        const start=await evaluate(`(() => {
          const r=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-fidelity3d-canvas').getBoundingClientRect();
          return {x:r.x+r.width*.65,y:r.y+r.height*.55};
        })()`);
        if(mobileViewport)await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...start,id:1}]});
        else await send('Input.dispatchMouseEvent',{type:'mousePressed',...start,button:'left',clickCount:1});
        for(let i=1;i<=8;i++){
          const point={x:start.x-Math.PI/2/.012*i/8,y:start.y-.05/.008*i/8};
          if(mobileViewport)await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,id:1}]});
          else await send('Input.dispatchMouseEvent',{type:'mouseMoved',...point,button:'left',buttons:1});
          await sleep(40);
        }
        if(mobileViewport)await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        else await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:start.x-Math.PI/2/.012,y:start.y-.05/.008,button:'left',clickCount:1});
        await waitFor(`(() => {
          const s=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-fidelity3d-canvas').closest('.abags-bag-builder-stage');
          return Math.abs(Number(s.dataset.abagsFidelity3dRotationY)+Math.PI/2)<.03;
        })()`,`${label} opposite-side customer drag`);
        await sleep(180);
        let near=await anchorEvidence();
        const appearance=await verifyAccessoryAppearance(`${label}-opposite-side`,near);
        near=await anchorEvidence();
        if(near.front.sampled<12||near.front.contactRatio<.45||near.duplicateOrnament)throw new Error(`${label}: near-side ornament must reappear attached after rotating the bag: ${JSON.stringify(near)}`);
        await capture(`anchor-${label.toLowerCase()}-opposite-side.png`);
        await writeFile(path.join(qaDir,`anchor-${label.toLowerCase()}-occlusion.json`),JSON.stringify({far:results.find(item=>item.view==='Bok'),near:{...near,appearance}},null,2));
      }
      await choose("accent", "none");
      await waitFor(`(() => {
        const stage=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-vc-preview .abags-bag-builder-stage[data-abags-live-stage="true"]');
        const canvas=stage?.querySelector('.abags-accessory-fidelity-front');
        if(stage?.dataset.accent!=='none'||stage.dataset.abagsFidelity3dFrame!==stage.dataset.builderSignature||!(canvas instanceof HTMLCanvasElement))return false;
        if(stage.dataset.abagsFidelityOrnamentOwner==='webgl'&&(Number(stage.dataset.abagsFidelityOrnamentTriangles)!==0||stage.dataset.abagsFidelityOrnamentBounds))return false;
        const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
        for(let i=3;i<pixels.length;i+=4)if(pixels[i]>24)return false;
        return true;
      })()`, `${label} remove selected ornament`);
      await choose("accent", choices.find(([key]) => key === "accent")[1]);
      await waitFor(`(() => {
        const stage=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-vc-preview .abags-bag-builder-stage[data-abags-live-stage="true"]');
        return stage?.dataset.accent!=='none'&&stage?.dataset.abagsFidelity3dFrame===stage?.dataset.builderSignature&&Boolean(stage?.dataset.abagsFidelityAccessoryAnchor)&&
          (stage.dataset.abagsFidelityOrnamentOwner!=='webgl'||Number(stage.dataset.abagsFidelityOrnamentTriangles)>100);
      })()`, `${label} restore selected ornament`);
      return results;
    };

    const probeShoulderBand = async (label) => {
      const results=[];
      for(const view of ['Przód','3/4','Bok']){
        await clickView(view);
        let evidence=await anchorEvidence();
        if(evidence?.strapOwner!=='webgl-band')throw new Error(`${label}: missing canonical shoulder band.`);
        const appearance=await verifyAccessoryAppearance(`${label}-strap-${view}`,evidence,false,'strap');
        evidence=await anchorEvidence();
        assertRearAccessory(label,view,evidence);
        results.push({...evidence,view,strapAppearance:appearance});
        await capture(`band-${label}-${view==='Przód'?'front':view==='Bok'?'side':'three-quarter'}.png`);
        await writeFile(path.join(qaDir,`band-${label}-evidence.json`),JSON.stringify(results,null,2));
      }
    };

    await send("Runtime.enable");
    await send("Page.enable");
    await waitFor("document.readyState === 'complete'", "initial load");


    const probeReferenceModels = async (label, viewport) => {
      await setViewport(viewport);
      await clearAndReload();
      await openBuilder();
      const cases = [
        ['chocolate-crossbody-bow','shoulder|#65493D|classic|none|none|crochet-braid|gold|bow','solid','model-3d'],
        ['forest-ocean-wood-bow','tall-tote|#0E9AA7|classic|none|wood-light|woven-striped|gold|bow','forest-ocean','model-3d'],
        ['navy-tall-wood-bow','tall-tote|#24324D|classic|none|wood-light|chain-leather|gold|bow','solid','photograph'],
        ['cacao-cream-wood-bow','tall-tote|#88583F|classic|none|wood-light|none|gold|bow','cacao-cream','photograph'],
        ['pastel-striped-wood-bow','tall-tote|#BA9ECF|classic|none|wood-light|none|gold|bow','pastel-bands','photograph'],
        ['rose-cream-dark-wood','tall-tote|#D58FAA|classic|none|wood-dark|woven-floral|gold|bow','rose-cream','photograph'],
      ];
      const native = async () => evaluate(`(() => {
        const stage=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-vc-preview .abags-bag-builder-stage[data-abags-live-stage="true"]');
        const canvas=stage?.querySelector('.abags-fidelity3d-canvas'),gl=canvas?.getContext('webgl');
        if(!gl||gl.isContextLost())return null;
        const proof=JSON.parse(stage.dataset.abagsFidelityReferenceModel||'null');
        const program=gl.getParameter(gl.CURRENT_PROGRAM),printLocation=gl.getUniformLocation(program,'uTextileReady');
        const textileUniform=printLocation?Array.from(gl.getUniform(program,printLocation)):null;
        const pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
        gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        let hash=2166136261,opaque=0;
        for(let i=0;i<pixels.length;i++){hash^=pixels[i];hash=Math.imul(hash,16777619)>>>0;if(i%4===3&&pixels[i]>24)opaque++;}
        const colors=(proof?.probes||[]).map(point=>{
          const x=Math.max(4,Math.min(gl.drawingBufferWidth-5,Math.round(point.x)));
          const y=Math.max(4,Math.min(gl.drawingBufferHeight-5,gl.drawingBufferHeight-1-Math.round(point.y)));
          const channels=[[],[],[]];
          for(let row=-4;row<=4;row++)for(let col=-4;col<=4;col++){
            const i=((y+row)*gl.drawingBufferWidth+x+col)*4;
            if(pixels[i+3]<200)continue;
            for(let c=0;c<3;c++)channels[c].push(pixels[i+c]);
          }
          if(channels[0].length<20)return null;
          const rgb=channels.map(values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)]);
          const [r,g,b]=rgb,max=Math.max(...rgb),min=Math.min(...rgb),d=max-min;
          let hue=d?max===r?60*(((g-b)/d)%6):max===g?60*((b-r)/d+2):60*((r-g)/d+4):0;
          if(hue<0)hue+=360;
          return {level:point.level,rgb,hue,sat:max?d/max:0,luma:.2126*r+.7152*g+.0722*b};
        });
        const rect=canvas.getBoundingClientRect(),style=getComputedStyle(canvas);
        const card=proof&&document.querySelector('button[data-abags-photo-model="'+proof.id+'"]');
        const thumb=card?.querySelector('.abags-ref-family-photo');
        return {signature:stage.dataset.builderSignature,current:stage.dataset.abagsFidelity3dFrame===stage.dataset.builderSignature&&stage.dataset.abagsFinal3dSignature===stage.dataset.builderSignature,
          proof,textileUniform,colors,hash,opaque,error:gl.getError(),selected:card?.getAttribute('aria-pressed')==='true',thumbnail:thumb?.dataset.referenceKind||'',
          canSave:Boolean(document.querySelector('button[data-builder-save-state]:not(:disabled)')),
          visible:rect.width>40&&rect.height>40&&rect.top<innerHeight&&rect.bottom>0&&style.visibility==='visible'&&Number(style.opacity)>.05};
      })()`);
      const waitModel = async (id,signature) => waitFor(`(() => {
        const stage=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-vc-preview .abags-bag-builder-stage[data-abags-live-stage="true"]');
        return stage?.dataset.builderSignature===${JSON.stringify(signature)}&&stage.dataset.abagsFidelity3dFrame===stage.dataset.builderSignature&&
          stage.dataset.abagsFinal3d==='ready'&&stage.dataset.abagsFinal3dSignature===stage.dataset.builderSignature&&
          JSON.parse(stage.dataset.abagsFidelityReferenceModel||'null')?.id===${JSON.stringify(id)}&&!stage.dataset.abagsFidelity3dError&&
          (() => {const print=JSON.parse(stage.dataset.abagsFidelityTextilePrint||'null');return print?.scarf&&(!print.strapUrl||print.strap);})();
      })()`,`${label} reference model ${id}`,25_000);
      const results=[];
      for(const [id,signature,palette,thumbnail] of cases){
        const point=await waitFor(`(() => {
          const button=document.querySelector('.abags-builder-controls button[data-abags-photo-model="${id}"]');
          if(!button||button.disabled)return null;
          const legend=button.closest('fieldset')?.querySelector('legend');
          if(legend&&legend.getAttribute('aria-expanded')!=='true'){legend.click();return null;}
          button.scrollIntoView({block:'nearest',inline:'nearest'});
          const r=button.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
          if(r.width<20||r.height<20||!button.contains(document.elementFromPoint(x,y)))return null;
          return {x,y};
        })()`,`${label} visible reference card ${id}`);
        if(mobileViewport){
          await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1}]});
          await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        }else{
          await send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
          await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
          await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
        }
        await waitModel(id,signature);
        await waitFor(`document.querySelector('button[data-abags-photo-model="${id}"] .abags-ref-family-photo')?.dataset.referenceKind===${JSON.stringify(thumbnail)}`,`${label} reference thumbnail ${id}`);
        await sleep(180);
        const evidence=await native();
        if(!evidence?.visible||!evidence.current||!evidence.selected||!evidence.canSave||evidence.error||evidence.opaque<1000||
          evidence.proof?.palette!==palette||evidence.proof.constructionTriangles<100||evidence.thumbnail!==thumbnail){
          throw new Error(`${label} ${id}: reference card did not generate complete visible 3D: ${JSON.stringify(evidence)}`);
        }
        const [low,blue,pink,high]=evidence.colors;
        if(palette!=='solid'&&(!low||!blue||!pink||!high))throw new Error(`${label} ${id}: yarn probe pixels missing`);
        const hueBetween=(color,a,b)=>color.hue>=a&&color.hue<=b;
        if(palette==='forest-ocean'&&(!hueBetween(low,185,255)||!hueBetween(high,55,145)||low.sat<.3||high.sat<.25))throw new Error(`${label}: green/ocean dye absent in actual body pixels: ${JSON.stringify(evidence.colors)}`);
        if(palette==='cacao-cream'&&(high.luma<low.luma*1.7||high.sat>.28))throw new Error(`${label}: cream-to-chocolate dye absent in actual body pixels: ${JSON.stringify(evidence.colors)}`);
        if(palette==='pastel-bands'&&(!hueBetween(low,255,320)||!hueBetween(blue,180,245)||!(pink.hue>=315||pink.hue<=12)||high.sat>.24||high.luma<100))throw new Error(`${label}: four ordered pastel bands absent in actual body pixels: ${JSON.stringify(evidence.colors)}`);
        if(palette==='rose-cream'&&(low.sat<.45||high.sat>.30||high.luma<low.luma*1.3))throw new Error(`${label}: cream/pink/fuchsia dye absent in actual body pixels: ${JSON.stringify(evidence.colors)}`);
        const hasPrintedStrap=['woven-floral','woven-striped','woven-ornament'].includes(signature.split('|')[5]);
        if(!evidence.proof.textilePrint?.scarf||evidence.textileUniform?.[0]!==1||
          (hasPrintedStrap&&(!evidence.proof.textilePrint.strap||evidence.textileUniform?.[1]!==1)))
          throw new Error(`${label} ${id}: selected textile images must be uploaded and active in the real WebGL shader: ${JSON.stringify(evidence)}`);
        await capture(`model-${label}-${id}-three-quarter.png`);
        if(palette==='forest-ocean'){
          await waitFor(`JSON.parse(localStorage.getItem('abags-bag-builder-v3')||'{}').color==='#0E9AA7'`,`${label} green model persisted`);
          await reloadCdpDocument(send,evaluate);
          await openBuilder();await waitModel(id,signature);await sleep(180);
          const restored=await native();
          if(!restored?.current||restored.signature!==signature||restored.hash!==evidence.hash)throw new Error(`${label}: saved reference model did not restore the same visible pixels: ${JSON.stringify(restored)}`);
          evidence.restored={signature:restored.signature,hash:restored.hash};
        }
        if(palette!=='solid'){
          await clickView('Bok');const side=await native();
          if(!side?.current||side.error||side.opaque<1000||side.hash===evidence.hash)throw new Error(`${label} ${id}: side rotation did not redraw real geometry`);
          evidence.side={hash:side.hash,error:side.error,opaque:side.opaque};
          await capture(`model-${label}-${id}-side.png`);await clickView('3/4');
        }
        results.push(evidence);
        await writeFile(path.join(qaDir,`model-${label}-evidence.json`),JSON.stringify(results,null,2));
      }
      if(new Set(results.map(item=>item.hash)).size!==6)throw new Error(`${label}: photographed model cards reused one rendered image`);
      console.log(`${label}: six photographed model presets, actual gradient pixels, real taps/clicks, side views and persisted green model PASS`);
    };
    const probeOwnerCorrections = async (label, viewport) => {
      await setViewport(viewport); await clearAndReload(); await openBuilder();
      const results = [];
      const showPreview = async () => {
        await evaluate(`document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-vc-preview .abags-fidelity3d-canvas')?.scrollIntoView({block:'center',inline:'nearest'})`);
        await sleep(180);
      };
      const read = async () => evaluate(`(() => {
        const stage=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-vc-preview .abags-bag-builder-stage[data-abags-live-stage="true"]');
        const canvas=stage?.querySelector('.abags-fidelity3d-canvas'),gl=canvas?.getContext('webgl');
        if(!gl||gl.isContextLost())return null;
        const proof=JSON.parse(canvas.dataset.abagsFidelityOwnerCorrection||'null');
        const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,pixels=new Uint8Array(w*h*4);
        gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        const colors=(proof?.probes||[]).map(p=>{
          const x=Math.max(4,Math.min(w-5,Math.round(p.x))),y=Math.max(4,Math.min(h-5,h-1-Math.round(p.y))),channels=[[],[],[]];
          for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){
            const i=((y+dy)*w+x+dx)*4;if(pixels[i+3]<200)continue;
            for(let c=0;c<3;c++)channels[c].push(pixels[i+c]);
          }
          if(channels[0].length<20)return null;
          const rgb=channels.map(a=>a.sort((a,b)=>a-b)[Math.floor(a.length/2)]),[r,g,b]=rgb,max=Math.max(...rgb),d=max-Math.min(...rgb);
          let hue=d?max===r?60*(((g-b)/d)%6):max===g?60*((b-r)/d+2):60*((r-g)/d+4):0;if(hue<0)hue+=360;
          return {rgb,hue,sat:max?d/max:0,luma:.2126*r+.7152*g+.0722*b};
        });
        let hash=2166136261,opaque=0;
        for(let i=0;i<pixels.length;i++){hash^=pixels[i];hash=Math.imul(hash,16777619)>>>0;if(i%4===3&&pixels[i]>24)opaque++;}
        return {proof,colors,hash,opaque,error:gl.getError(),signature:stage.dataset.builderSignature};
      })()`);
      const waitState = signature => waitFor(`(() => {
        const s=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-vc-preview .abags-bag-builder-stage[data-abags-live-stage="true"]');
        return s?.dataset.builderSignature===${JSON.stringify(signature)}&&s.dataset.abagsFidelity3dFrame===s.dataset.builderSignature&&
          s.dataset.abagsFinal3d==='ready'&&s.dataset.abagsFinal3dSignature===s.dataset.builderSignature&&!s.dataset.abagsFidelity3dError;
      })()`,`${label} corrected model ${signature}`,25_000);
      for (const [id,signature] of [
        ['pastel-mini','mini|#BA9ECF|basket|crochet|none|chain|gold|tassel'],
        ['mustard-round','round|#C7962F|shell|crochet|none|woven|gold|tassel'],
      ]) {
        const point=await waitFor(`(() => {
          const b=document.querySelector('button[data-ref-preset="${id}"]');if(!b||b.disabled)return null;
          b.scrollIntoView({block:'center',inline:'center'});const r=b.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
          return r.width>20&&r.height>20&&b.contains(document.elementFromPoint(x,y))?{x,y}:null;
        })()`,`${label} visible ${id} inspiration`);
        if(mobileViewport){await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1}]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
        else{await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});}
        await waitState(signature); await showPreview();
        await capture(`correction-${label}-${id}-initial.png`);
        await clickView('Przód'); await sleep(180);
        const evidence=await read();
        if(!evidence||evidence.error||evidence.opaque<1000||evidence.proof?.id!==id)throw new Error(`${label} ${id}: missing corrected 3D: ${JSON.stringify(evidence)}`);
        if(id==='pastel-mini'){
          if(evidence.proof.axis!=='x'||evidence.colors.length!==8||evidence.colors.some(c=>!c))throw new Error(`${label}: missing mini column samples`);
          for(const offset of [0,4]){
            const [teal,pink,cream,lilac]=evidence.colors.slice(offset,offset+4);
            if(teal.hue<155||teal.hue>215||teal.sat<.2||!(pink.hue>=310||pink.hue<20)||cream.sat>.28||cream.luma<100||lilac.hue<250||lilac.hue>320)
              throw new Error(`${label}: pastel mini must show four vertical colors at both heights: ${JSON.stringify(evidence.colors)}`);
          }
        }else if(evidence.proof.flapTone!=='#222124'||evidence.colors.length!==2||evidence.colors.some(c=>!c||c.luma>85||c.sat>.25)){
          throw new Error(`${label}: mustard flap and centered tassel must both be black: ${JSON.stringify(evidence)}`);
        }
        await capture(`correction-${label}-${id}-front.png`);
        evidence.views=[];
        for(const view of ['3/4','Bok']){
          await clickView(view);await sleep(180);const rotated=await read();
          if(!rotated||rotated.error||rotated.opaque<1000||rotated.hash===evidence.hash)throw new Error(`${label} ${id}: rotation did not redraw actual 3D`);
          evidence.views.push({view,hash:rotated.hash});await capture(`correction-${label}-${id}-${view==='Bok'?'side':'three-quarter'}.png`);
        }
        await waitFor(`(() => {const c=JSON.parse(localStorage.getItem('abags-bag-builder-v3')||'{}');return [c.family,c.color,c.stitch,c.flap,c.handles,c.strap,c.hardware,c.accent].join('|')===${JSON.stringify(signature)};})()`,`${label} ${id} saved model`);
        await reloadCdpDocument(send,evaluate);await openBuilder();await waitState(signature);
        await showPreview();await clickView('Przód');await sleep(180);const restored=await read();
        if(restored?.proof?.id!==id||restored.signature!==signature||restored.hash!==evidence.hash)throw new Error(`${label} ${id}: restored correction differs: ${JSON.stringify(restored)}`);
        results.push(evidence);await writeFile(path.join(qaDir,`correction-${label}-evidence.json`),JSON.stringify(results,null,2));
      }
      console.log(`${label}: vertical pastel-mini pixels, black crochet flap and centered black tassel, rotations and persistence PASS`);
    };

    // Separate the expensive new reference-model GPU checks from the established
    // accessory/family browser scenarios; both remain required in CI.
    const qaSuite = process.env.ABAGS_ANCHOR_QA_SUITE || "all";
    if (!["all", "reference", "corrections", "legacy"].includes(qaSuite)) throw new Error(`Unknown anchor QA suite: ${qaSuite}`);
    // All required suites still execute in CI, but each GPU-heavy browser
    // sequence runs on its own worker. Repeated WebGL context restoration
    // after twelve model presets previously exhausted CDP just as the mini
    // color correction probes began on mobile.
    if (qaSuite === "all" || qaSuite === "reference") {
      await probeReferenceModels('desktop',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
      await probeReferenceModels('mobile',{width:390,height:844,deviceScaleFactor:2,mobile:true});
    }
    if (qaSuite === "all" || qaSuite === "corrections") {
      await probeOwnerCorrections('desktop',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
      await probeOwnerCorrections('mobile',{width:390,height:844,deviceScaleFactor:2,mobile:true});
    }
    if (qaSuite === "reference" || qaSuite === "corrections") {
      console.log("REFERENCE/CORRECTION MODEL DESKTOP/MOBILE QA PASS:", qaSuite, productionUrl);
      return;
    }

    const probeFamilyCards = async (label, viewport) => {
      await setViewport(viewport);
      await clearAndReload();
      await openBuilder();
      const signatures = [
        'tote|#E4A9B5|classic|none|wood-light|none|gold|bow',
        'round|#E8DDCC|shell|crochet|none|woven|gold|tassel',
        'bucket|#E8DDCC|classic|suede-burgundy|none|leather|gold|none',
        'mini|#BA9ECF|basket|crochet|none|chain|gold|tassel',
        'satchel|#C7652F|classic|leather-cognac|leather-braid|woven-ornament|gold|none',
      ];
      const currentFamily = await evaluate(`document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-vc-preview .abags-bag-builder-stage[data-abags-live-stage="true"]')?.dataset.family`);
      if (currentFamily) throw new Error(`${label}: family cards did not start from an empty selection.`);
      const results = [];
      // Each model must appear after just one real Fason card click/tap.
      // Return from the cognac satchel to tote to cover component replacement.
      for (const signature of [...signatures, signatures[0]]) {
        const family = signature.split('|')[0];
        const point = await waitFor(`(() => {
          const button=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-builder-controls button[data-builder-key="family"][data-builder-value="${family}"]');
          if(!button||button.disabled)return null;
          button.scrollIntoView({block:'nearest',inline:'nearest'});
          const rect=button.getBoundingClientRect(),style=getComputedStyle(button);
          const x=rect.left+rect.width/2,y=rect.top+rect.height/2,hit=document.elementFromPoint(x,y);
          if(rect.width<20||rect.height<20||style.visibility!=='visible'||!button.contains(hit))return null;
          return {x,y};
        })()`, `${label} visible ${family} Fason card`);
        if (mobileViewport) {
          await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1}]});
          await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        } else {
          await send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
          await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
          await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
        }
        await waitFor(`(() => {
          const stage=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-vc-preview .abags-bag-builder-stage[data-abags-live-stage="true"]');
          return stage?.dataset.builderSignature===${JSON.stringify(signature)}&&
            stage.dataset.abagsFidelity3dFrame===stage.dataset.builderSignature&&
            stage.dataset.abagsFinal3d==='ready'&&stage.dataset.abagsFinal3dSignature===stage.dataset.builderSignature&&
            !stage.dataset.abagsFidelity3dError;
        })()`, `${label} ${family} complete model from one family selection`, 20_000);
        await sleep(180);
        const evidence = await evaluate(`(() => {
          const stage=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-vc-preview .abags-bag-builder-stage[data-abags-live-stage="true"]');
          const canvas=stage?.querySelector('.abags-fidelity3d-canvas'),gl=canvas?.getContext('webgl');
          if(!gl||gl.isContextLost())return null;
          const pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
          gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
          let hash=2166136261,opaque=0;
          for(let i=0;i<pixels.length;i++){hash^=pixels[i];hash=Math.imul(hash,16777619)>>>0;if(i%4===3&&pixels[i]>24)opaque++;}
          const rect=canvas.getBoundingClientRect(),style=getComputedStyle(canvas);
          const button=document.querySelector('.abags-builder-controls button[data-builder-key="family"][data-builder-value="${family}"]');
          const save=document.querySelector('button[data-builder-save-state]');
          return {family:stage.dataset.family,signature:stage.dataset.builderSignature,hash,opaque,error:gl.getError(),
            selected:button?.getAttribute('aria-pressed')==='true',canSave:Boolean(save&&!save.disabled),
            cognacProof:Boolean(stage.dataset.abagsFidelityCognac),
            visible:rect.width>40&&rect.height>40&&rect.bottom>0&&rect.top<innerHeight&&style.visibility==='visible'&&Number(style.opacity)>.05};
        })()`);
        if(!evidence?.visible||!evidence.selected||!evidence.canSave||evidence.error||evidence.opaque<1000||
          evidence.signature!==signature||(family!=='satchel'&&evidence.cognacProof)) {
          throw new Error(`${label} ${family}: family card did not create a complete visible editable bag: ${JSON.stringify(evidence)}`);
        }
        results.push(evidence);
        await capture(`family-${label}-${family}.png`);
        await writeFile(path.join(qaDir,`family-${label}-evidence.json`),JSON.stringify(results,null,2));
      }
      if(new Set(results.slice(0,5).map(item=>item.hash)).size!==5)throw new Error(`${label}: Fason cards reused the same rendered model.`);
      console.log(`${label}: all five complete editable models generated by single visible Fason card clicks/taps PASS`);
    };
    await probeFamilyCards('desktop',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
    await probeFamilyCards('mobile',{width:390,height:844,deviceScaleFactor:2,mobile:true});

    const probeCognac = async (label, viewport) => {
      await setViewport(viewport);
      await clearAndReload();
      await openBuilder();
      // One customer selection must restore the complete photograph preset.
      await choose('family', 'satchel');
      const signature = 'satchel|#C7652F|classic|leather-cognac|leather-braid|woven-ornament|gold|none';
      const frame = async (remember = false) => evaluate(`(() => {
        const stage=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-vc-preview .abags-bag-builder-stage[data-abags-live-stage="true"]');
        const canvas=stage?.querySelector('.abags-fidelity3d-canvas'),gl=canvas?.getContext('webgl');
        if(!gl||gl.isContextLost())return null;
        const pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
        gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        let hash=2166136261,opaque=0,changed=0;
        const baseline=canvas.__abagsCognacFullFrame;
        for(let i=0;i<pixels.length;i+=4){
          if(pixels[i+3]>24)opaque++;
          if(baseline?.length===pixels.length&&Math.abs(pixels[i]-baseline[i])+Math.abs(pixels[i+1]-baseline[i+1])+Math.abs(pixels[i+2]-baseline[i+2])+Math.abs(pixels[i+3]-baseline[i+3])>24)changed++;
          for(let j=0;j<4;j++){hash^=pixels[i+j];hash=Math.imul(hash,16777619)>>>0;}
        }
        if(${remember})canvas.__abagsCognacFullFrame=pixels;
        const rect=canvas.getBoundingClientRect(),style=getComputedStyle(canvas);
        return {signature:stage.dataset.builderSignature,current:stage.dataset.abagsFidelity3dFrame===stage.dataset.builderSignature,
          proof:JSON.parse(stage.dataset.abagsFidelityCognac||'null'),
          textilePrint:JSON.parse(stage.dataset.abagsFidelityTextilePrint||'null'),
          textileUniform:(() => {const program=gl.getParameter(gl.CURRENT_PROGRAM),location=program&&gl.getUniformLocation(program,'uTextileReady');return location?[...gl.getUniform(program,location)]:null;})(),
          error:gl.getError(),hash,opaque,changed,
          reference:stage.dataset.abagsRealFamilyReference,visible:rect.width>40&&rect.height>40&&style.visibility==='visible'&&Number(style.opacity)>.05};
      })()`);
      const views=[];
      for(const view of ['Przód','3/4','Bok']){
        await clickView(view);
        const evidence=await frame();
        if(!evidence?.current||!evidence.visible||evidence.error||evidence.signature!==signature||evidence.opaque<1000||
          evidence.reference!=='cognac-ombre-braided-satchel'||evidence.proof?.version!=='cognac-ombre-v1'||!evidence.proof.ombre||
          evidence.proof.handleTriangles<1000||evidence.proof.flapTriangles<1000||evidence.proof.badgeTriangles<100||evidence.proof.jacquardTriangles<1000){
          throw new Error(`${label} cognac ${view}: missing the complete visible reference model: ${JSON.stringify(evidence)}`);
        }
        if(!evidence.textilePrint?.strap||!evidence.textilePrint.strapUrl?.endsWith('/copper-jacquard-webbing-v1.jpg')||evidence.textileUniform?.[1]!==1)
          throw new Error(`${label} cognac ${view}: jacquard texture is not active: ${JSON.stringify(evidence)}`);
        views.push({view,...evidence});
        await capture(`cognac-${label}-${view==='Przód'?'front':view==='Bok'?'side':'three-quarter'}.png`);
      }
      if(new Set(views.map(v=>v.hash)).size!==3)throw new Error(`${label}: cognac views did not rotate the real model`);
      await clickView('Przód');
      const removals=[];
      for(const [key,value,proofKey] of [['handles','leather-braid','handleTriangles'],['strap','woven-ornament','jacquardTriangles'],['flap','leather-cognac','flapTriangles']]){
        await frame(true);
        await choose(key,'none');
        const evidence=await frame();
        if(!evidence?.current||evidence.error||evidence.proof?.[proofKey]!==0||evidence.changed<80)throw new Error(`${label}: ${key} removal did not change customer pixels: ${JSON.stringify(evidence)}`);
        removals.push({key,...evidence});
        await choose(key,value);
      }
      await waitFor(`JSON.parse(localStorage.getItem('abags-bag-builder-v3')||'{}').strap==='woven-ornament'`,`${label} cognac draft saved`);
      await reloadCdpDocument(send,evaluate);
      await openBuilder();
      await waitFor(`document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-vc-preview .abags-bag-builder-stage[data-abags-live-stage="true"]')?.dataset.abagsFidelity3dFrame===${JSON.stringify(signature)}`,`${label} complete saved model restored`);
      const restored=await frame();
      if(restored?.signature!==signature||!restored.proof?.ombre)throw new Error(`${label}: saved cognac model was lost`);
      await choose('family','tote');
      if((await frame())?.proof)throw new Error(`${label}: cognac geometry proof leaked into the old tote model`);
      await choose('family','satchel');
      await writeFile(path.join(qaDir,`cognac-${label}-evidence.json`),JSON.stringify({views,removals,restored},null,2));
      console.log(`${label}: cognac ombre satchel, braid, push-lock, badge and jacquard visible in three views; removals and saved preset PASS`);
    };
    await probeCognac('desktop',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
    await probeCognac('mobile',{width:390,height:844,deviceScaleFactor:2,mobile:true});


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
    await choose('strap','woven');
    await probeShoulderBand('mobile-woven');

    await setViewport({ width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await clearAndReload();
    await openBuilder();
    for (const [key, value] of [["family", "tote"], ["color", "#E4A9B5"], ["stitch", "classic"], ["handles", "wood-light"], ["accent", "scarf"]]) await choose(key, value);
    const scarf = [];
    for (const view of ["Przód", "3/4", "Bok"]) {
      await clickView(view);
      await waitFor(`(() => {
        const stage=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-vc-preview .abags-bag-builder-stage[data-abags-live-stage="true"]');
        return stage?.dataset.abagsFidelityAccessorySignature===stage?.dataset.builderSignature && Boolean(stage?.dataset.abagsFidelityAccessoryAnchor);
      })()`, "current scarf attachment metadata");
      let evidence = await anchorEvidence();
      const appearance = await verifyAccessoryAppearance(`scarf-${view}`, evidence);
      evidence = await anchorEvidence();
      scarf.push({ view, ornament: evidence?.ornament, appearance });
      await capture(`anchor-scarf-${view === "Przód" ? "front" : view === "Bok" ? "side" : "three-quarter"}.png`);
      const contact = evidence?.ornament;
      if (!contact?.current || contact.point[1] < .7 || contact.wood < 2 || contact.knot < 4) {
        throw new Error(`Scarf ${view}: knot must touch the actual wooden handle: ${JSON.stringify(contact)}`);
      }
    }
    await writeFile(path.join(qaDir, "anchor-scarf-evidence.json"), JSON.stringify(scarf, null, 2));


    const probeOpeningInterior = async (label) => {
      for (const [key, value] of [['family','tote'],['color','#B93A42'],['stitch','classic'],['flap','none'],['handles','wood-dark'],['strap','none'],['accent','none']]) await choose(key, value);
      await clickView('3/4');
      const point = await evaluate(`(() => { const r=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-vc-preview .abags-fidelity3d-canvas').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
      if (mobileViewport) await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1}]});
      else await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
      for (let i=1;i<=5;i++) {
        const next={x:point.x,y:point.y+i*20};
        if (mobileViewport) await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...next,id:1}]});
        else await send('Input.dispatchMouseEvent',{type:'mouseMoved',...next,button:'left',buttons:1});
        await sleep(40);
      }
      if (mobileViewport) await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      else await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y+100,button:'left',clickCount:1});
      await waitFor(`Number(document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-vc-preview .abags-bag-builder-stage')?.dataset.abagsFidelity3dRotationX)>.50`,`${label} real pointer reveals lining`);
      await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))');
      const proof=await evaluate(`(() => {
        const stage=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-vc-preview .abags-bag-builder-stage');
        const canvas=stage.querySelector('.abags-fidelity3d-canvas'),gl=canvas.getContext('webgl');
        const interior=JSON.parse(stage.dataset.abagsFidelityInterior||'null');
        if(!interior?.probe||!gl||gl.isContextLost())return null;
        const zoom=Number(stage.dataset.abagsFidelity3dZoom),yaw=Number(stage.dataset.abagsFidelity3dRotationY),pitch=Number(stage.dataset.abagsFidelity3dRotationX);
        let [x,y,z]=interior.probe.map(n=>n*zoom);
        [x,z]=[x*Math.cos(yaw)+z*Math.sin(yaw),-x*Math.sin(yaw)+z*Math.cos(yaw)];
        [y,z]=[y*Math.cos(pitch)-z*Math.sin(pitch),y*Math.sin(pitch)+z*Math.cos(pitch)];
        y-=.02;z-=5;
        const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,f=1/Math.tan(Math.PI/5.3/2);
        const px=Math.round((.5+x*f/(w/h)/-z*.5)*w),py=Math.round((.5-y*f/-z*.5)*h),radius=4,size=radius*2+1;
        if(px<radius||py<radius||px>=w-radius||py>=h-radius)return null;
        const pixels=new Uint8Array(size*size*4);
        gl.readPixels(px-radius,h-1-py-radius,size,size,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        let clothPixels=0;
        for(let i=0;i<pixels.length;i+=4){const [r,g,b,a]=pixels.subarray(i,i+4);if(a>24&&r>130&&g>120&&b>100&&Math.abs(r-g)<35&&Math.abs(g-b)<40)clothPixels++;}
        return {interior,pitch,yaw,clothPixels,point:{x:px,y:py},error:gl.getError(),current:stage.dataset.abagsFidelity3dFrame===stage.dataset.builderSignature,visible:getComputedStyle(canvas).visibility!=='hidden'&&Number(getComputedStyle(canvas).opacity)>.05};
      })()`);
      await capture(`interior-${label}-open.png`);
      await writeFile(path.join(qaDir,`interior-${label}-evidence.json`),JSON.stringify(proof,null,2));
      if(!proof?.current||!proof.visible||proof.error||proof.interior.family!=='tote'||proof.interior.finish!=='gingham'||proof.interior.topY-proof.interior.bottomY<1.2||proof.interior.triangles<5000||proof.interior.seamTriangles<500||proof.clothPixels<8)throw new Error(`${label}: missing visible physical fabric lining after customer rotation: ${JSON.stringify(proof)}`);
      console.log(`${label}: deep fabric lining and fine sewn mouth visible after real pointer rotation PASS`);
    };
    await probeOpeningInterior('desktop');

    // The new standalone Kokarda must be tested independently from the longer scarf.
    // Compare actual customer screenshots against accent=none on both device classes,
    // then verify its physical bounds are shorter than the long apaszka.
    const verifyStandaloneBow = async (label, viewport) => {
      await setViewport(viewport);
      await clearAndReload();
      await openBuilder();
      for (const [key, value] of [
        ["family", "tote"], ["color", "#E4A9B5"], ["stitch", "classic"],
        ["handles", "wood-light"], ["accent", "bow"],
      ]) await choose(key, value);
      const accentOrder = await evaluate(`(() => [...document.querySelectorAll('.abags-vc-dialog.abags-reference-layout-v4 .abags-builder-controls button[data-builder-key="accent"]')].filter(button=>!button.disabled).map(button=>button.dataset.builderValue))()`);
      if (accentOrder[0] !== "none" || accentOrder[1] !== "bow") {
        throw new Error(`${label}: Kokarda must be first after Bez ozdoby on mobile/desktop: ${JSON.stringify(accentOrder)}`);
      }
      const results = [];
      for (const view of ["Przód", "3/4", "Bok"]) {
        await clickView(view);
        const evidence = await anchorEvidence();
        if (evidence?.ornamentOwner !== "webgl" || evidence.ornamentTriangles < 100 || evidence.duplicateOrnament || evidence.ornamentConstruction !== 'folded-fabric-gravity-fringe-v3') {
          throw new Error(`${label} Kokarda ${view}: missing the single physical WebGL bow: ${JSON.stringify(evidence)}`);
        }
        const appearance = await verifyAccessoryAppearance(`${label}-kokarda-${view}`, evidence, view === "Bok");
        const after = await anchorEvidence();
        if (!after?.ornament?.current || after.ornament.wood < 2 || after.ornament.knot < 4) {
          throw new Error(`${label} Kokarda ${view}: fabric knot is detached from the real wooden handle: ${JSON.stringify(after?.ornament)}`);
        }
        results.push({ view, owner: evidence.ornamentOwner, triangles: evidence.ornamentTriangles, appearance, ornament: after.ornament });
        await capture(`kokarda-${label.toLowerCase()}-${view === "Przód" ? "front" : view === "Bok" ? "side" : "three-quarter"}.png`);
      }
      const bounds = await evaluate(`(() => {
        const stage=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-vc-preview .abags-bag-builder-stage[data-abags-live-stage="true"]');
        return JSON.parse(stage?.dataset.abagsFidelityOrnamentBounds||'null');
      })()`);
      await choose("accent", "scarf");
      const scarfBounds = await evaluate(`(() => {
        const stage=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-vc-preview .abags-bag-builder-stage[data-abags-live-stage="true"]');
        return JSON.parse(stage?.dataset.abagsFidelityOrnamentBounds||'null');
      })()`);
      if (!bounds || !scarfBounds || bounds.min[1] <= scarfBounds.min[1] + .12) {
        throw new Error(`${label}: Kokarda has the same long tails as Apaszka: ${JSON.stringify({ bounds, scarfBounds })}`);
      }
      await writeFile(path.join(qaDir,`kokarda-${label.toLowerCase()}-evidence.json`), JSON.stringify({ bow: bounds, scarf: scarfBounds, views: results }, null, 2));
      await choose("accent", "bow");
    };

    await verifyStandaloneBow("desktop", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await verifyStandaloneBow("mobile", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await probeOpeningInterior('mobile');

    await setViewport({ width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    for(const [key,value] of [['family','bucket'],['handles','none'],['color','#E8DDCC'],['flap','leather-black'],['strap','leather'],['accent','tassel']])await choose(key,value);
    await probeShoulderBand('desktop-leather');


    console.log("ACCESSORY ANCHOR INTEGRITY PASS:", productionUrl);
    console.log("- Przód / 3/4 / Bok use the authoritative Fidelity3D transform: yes");
    console.log("- rear strap/chain remains attached to WebGL side hardware on desktop/mobile: yes");
    console.log("- front flap/accent remains attached to the WebGL body on desktop/mobile: yes");
    console.log("- both accessory depth canvases redraw uniquely for all three views: yes");
    console.log("- scarf knot touches the wooden handle in Przód / 3/4 / Bok: yes");
    console.log("- Kokarda visible in customer WebGL, anchored to wood, and shorter than Apaszka on desktop/mobile: yes");
    console.log("- ornaments visibly change front / three-quarter / near-side screenshots and obey far-side occlusion: yes");
    console.log("- woven and leather bands have visible 3D surfaces, no flat duplicate, and attached ends in all customer views: yes");
  console.log("- rigid wood handle retains two side-view WebGL depth clusters on desktop/mobile: yes");
  console.log("- rigid wood handle remains one coherent arch in Przód / 3/4 on desktop/mobile: yes");
  console.log("- desktop side handle evidence:", desktop.find((item) => item.view === "Bok")?.handle);
  console.log("- mobile side handle evidence:", mobile.find((item) => item.view === "Bok")?.handle);
    console.log("- desktop evidence:", desktop.map((item) => ({ view:item.view, back:item.back.contactRatio, front:item.front.contactRatio })));
    console.log("- mobile evidence:", mobile.map((item) => ({ view:item.view, back:item.back.contactRatio, front:item.front.contactRatio })));
  } finally {
    try { socket?.close(); } catch {}
    chrome.kill("SIGTERM");
    await new Promise((resolve) => {
      if (chrome.exitCode !== null || chrome.signalCode !== null) return resolve();
      const timer = setTimeout(() => { chrome.kill("SIGKILL"); resolve(); }, 2_000);
      chrome.once("exit", () => { clearTimeout(timer); resolve(); });
    });
    await rm(chromeProfile, { recursive: true, force: true, maxRetries: 3 });
  }
}

main().catch((error) => {
  console.error("Customizer accessory-anchor integrity failed:", error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
