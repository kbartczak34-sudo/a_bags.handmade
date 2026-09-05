import { spawn, spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const productionUrl = process.env.ABAGS_PRODUCTION_URL || "https://abagshandmade.pl";
const port = Number(process.env.ABAGS_ALL_OPTIONS_CHROME_DEBUG_PORT || 9782);
const qaDir = process.env.ABAGS_REALTIME_QA_DIR || "artifacts/customizer-realtime";
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
  if (result?.exceptionDetails) throw new Error(result.exceptionDetails.text || "Runtime evaluation failed.");
  return result?.result?.value;
}

async function main() {
  const binary = chromeBinary();
  const url = `${productionUrl}${productionUrl.includes("?") ? "&" : "?"}abags-all-options-qa=${Date.now()}`;
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
      await waitFor("Boolean(document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-accessory-fidelity-canvas'))", "accessory fidelity surface");
    };

    const state = async () => evaluate(`(() => {
      const stage=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-bag-builder-stage');
      if(!stage)return null;
      return {
        family:stage.dataset.family||'',
        color:stage.dataset.color||'',
        stitch:stage.dataset.stitch||'',
        flap:stage.dataset.flap||'',
        handles:stage.dataset.handles||'',
        strap:stage.dataset.strap||'',
        hardware:stage.dataset.hardware||'',
        accent:stage.dataset.accent||'',
        signature:stage.dataset.builderSignature||'',
        frame:stage.dataset.abagsFidelity3dFrame||'',
        finalSignature:stage.dataset.abagsFinal3dSignature||'',
        final3d:stage.dataset.abagsFinal3d||'',
        rendererError:stage.dataset.abagsFidelity3dError||'',
        photoTrue:stage.dataset.abagsPhotoTrue||'',
        accessoryVersion:stage.querySelector('.abags-accessory-fidelity-canvas')?.dataset.abagsAccessoryFidelity||'',
      };
    })()`);

    const fingerprint = async () => evaluate(`(() => {
      const canvas=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-fidelity3d-canvas');
      const accessory=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4 .abags-accessory-fidelity-canvas');
      if(!(canvas instanceof HTMLCanvasElement) || !(accessory instanceof HTMLCanvasElement))return null;
      const gl=canvas.getContext('webgl');
      const overlay=accessory.getContext('2d');
      if(!gl || gl.isContextLost() || !overlay)return null;
      const width=gl.drawingBufferWidth;
      const height=gl.drawingBufferHeight;
      if(width<16 || height<16 || accessory.width<16 || accessory.height<16)return null;
      const pixels=new Uint8Array(width*height*4);
      gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      if(gl.getError()!==gl.NO_ERROR)return null;
      let hash=2166136261>>>0;
      let sampled=0;
      let opaque=0;
      let chromatic=0;
      let overlayOpaque=0;
      const mix=(r,g,b,a)=>{
        hash^=r; hash=Math.imul(hash,16777619)>>>0;
        hash^=g; hash=Math.imul(hash,16777619)>>>0;
        hash^=b; hash=Math.imul(hash,16777619)>>>0;
        hash^=a; hash=Math.imul(hash,16777619)>>>0;
      };
      const pixelCount=width*height;
      const step=Math.max(1,Math.floor(pixelCount/18000));
      for(let pixel=0;pixel<pixelCount;pixel+=step){
        const i=pixel*4;
        const r=pixels[i],g=pixels[i+1],b=pixels[i+2],a=pixels[i+3];
        sampled++;
        if(a>24)opaque++;
        if(a>24 && Math.max(r,g,b)-Math.min(r,g,b)>20)chromatic++;
        mix(r,g,b,a);
      }
      const overlayPixels=overlay.getImageData(0,0,accessory.width,accessory.height).data;
      const overlayCount=accessory.width*accessory.height;
      const overlayStep=Math.max(1,Math.floor(overlayCount/18000));
      for(let pixel=0;pixel<overlayCount;pixel+=overlayStep){
        const i=pixel*4;
        const r=overlayPixels[i],g=overlayPixels[i+1],b=overlayPixels[i+2],a=overlayPixels[i+3];
        if(a>24)overlayOpaque++;
        mix(r,g,b,a);
      }
      return {hash:hash.toString(16).padStart(8,'0'),width,height,sampled,opaque,chromatic,overlayOpaque,accessoryWidth:accessory.width,accessoryHeight:accessory.height};
    })()`);

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
        return stage?.dataset.abagsFinal3d==='ready' &&
          stage.dataset.abagsFinal3dSignature===stage.dataset.builderSignature &&
          stage.dataset.abagsFidelity3dFrame===stage.dataset.builderSignature &&
          Boolean(stage.querySelector('.abags-accessory-fidelity-canvas')) &&
          !stage.dataset.abagsFidelity3dError;
      })()`, `${label} verified final realtime composition`, 20_000);
      await sleep(220);
      const current = await state();
      if (!current || current.photoTrue === "active") throw new Error(`${label}: customer realtime mode was replaced by Photo-True.`);
      if (!current.accessoryVersion) throw new Error(`${label}: accessory fidelity surface is missing its version contract.`);
      return current;
    };

    const chooseVisible = async (key, value, label) => {
      const beforeState = await state();
      const beforePixels = await fingerprint();
      if (!beforeState || !beforePixels) throw new Error(`${label}: no readable realtime composition before ${key}=${value}.`);
      await choose(key, value);
      const afterState = await waitReady(`${label} ${key}=${value}`);
      const afterPixels = await fingerprint();
      if (!afterPixels) throw new Error(`${label}: no readable realtime composition after ${key}=${value}.`);
      if (afterState.signature === beforeState.signature) {
        throw new Error(`${label}: ${key}=${value} did not change the builder signature.`);
      }
      if (afterPixels.hash === beforePixels.hash) {
        throw new Error(`${label}: ${key}=${value} changed state but did not change visible composited pixels: ${JSON.stringify({ beforePixels, afterPixels, afterState })}`);
      }
      return { state: afterState, pixels: afterPixels };
    };

    const assertUnavailable = async (key, value, label) => {
      const availability = await evaluate(`(() => {
        const button=[...document.querySelectorAll('button[data-builder-key=${JSON.stringify(key)}]')]
          .find((node)=>node.dataset.builderValue===${JSON.stringify(value)});
        return button ? (button.disabled ? 'disabled' : 'available') : 'absent';
      })()`);
      if (availability === "available") throw new Error(`${label}: incompatible ${key}=${value} is incorrectly selectable.`);
    };

    const capture = async (name) => {
      const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
      await writeFile(path.join(qaDir, name), Buffer.from(shot.data, "base64"));
    };

    const runScenario = async ({ label, viewport, choices, incompatible = [] }) => {
      await send("Emulation.setDeviceMetricsOverride", viewport);
      if (viewport.mobile) {
        await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
      } else {
        await send("Emulation.setTouchEmulationEnabled", { enabled: false });
      }
      await clearAndReload();
      await openBuilder();

      const initial = await state();
      if (!initial || initial.family || initial.color || initial.stitch) throw new Error(`${label}: builder did not start empty: ${JSON.stringify(initial)}`);

      const visualResults = [];
      for (const [key, value] of choices) {
        const result = await chooseVisible(key, value, label);
        visualResults.push({ key, value, hash: result.pixels.hash, overlayOpaque: result.pixels.overlayOpaque, signature: result.state.signature });
      }
      for (const [key, value] of incompatible) await assertUnavailable(key, value, label);

      const final = await state();
      const finalPixels = await fingerprint();
      if (!final || final.final3d !== "ready" || final.signature !== final.frame || final.signature !== final.finalSignature) {
        throw new Error(`${label}: final renderer signatures are inconsistent: ${JSON.stringify(final)}`);
      }
      if (!finalPixels || finalPixels.overlayOpaque <= 0) {
        throw new Error(`${label}: selected accessories produced no visible pixels on the calibrated accessory surface: ${JSON.stringify(finalPixels)}`);
      }
      await capture(`accessory-${label.toLowerCase()}-final.png`);
      return { final, finalPixels, visualResults };
    };

    await send("Runtime.enable");
    await send("Page.enable");
    await waitFor("document.readyState === 'complete'", "initial load");

    const desktop = await runScenario({
      label: "Desktop",
      viewport: { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
      choices: [
        ["family", "mini"],
        ["color", "#E4A9B5"],
        ["stitch", "herringbone"],
        ["flap", "crochet"],
        ["handles", "wood-light"],
        ["strap", "woven"],
        ["hardware", "silver"],
        ["accent", "tassel"],
      ],
      incompatible: [["handles", "wood-dark"], ["handles", "crochet"], ["flap", "leather-cognac"], ["flap", "suede-burgundy"], ["strap", "leather"], ["accent", "scarf"]],
    });

    const mobile = await runScenario({
      label: "Mobile",
      viewport: { width: 390, height: 844, deviceScaleFactor: 2, mobile: true },
      choices: [
        ["family", "mini"],
        ["color", "#087E81"],
        ["stitch", "basket"],
        ["flap", "crochet"],
        ["handles", "wood-light"],
        ["strap", "chain"],
        ["hardware", "black"],
        ["accent", "charm"],
      ],
      incompatible: [["handles", "wood-dark"], ["handles", "crochet"], ["flap", "leather-cognac"], ["flap", "suede-burgundy"], ["strap", "leather"], ["accent", "scarf"]],
    });

    console.log("ALL REALTIME OPTIONS PASS:", productionUrl);
    console.log("- every builder field changed verified composited pixels on desktop: yes");
    console.log("- every builder field changed verified composited pixels on mobile: yes");
    console.log("- calibrated accessory surface present and non-empty for final desktop/mobile configurations: yes");
    console.log("- desktop final: mini / #E4A9B5 / herringbone / crochet / wood-light / woven / silver / tassel");
    console.log("- mobile final: mini / #087E81 / basket / crochet / wood-light / chain / black / charm");
    console.log("- Mini construction options are bounded to real Agata component evidence: yes");
    console.log("- unsupported Mini handles, leather/suede flaps, leather strap and scarf are unavailable: yes");
    console.log("- desktop fingerprints:", desktop.visualResults.map((item) => `${item.key}:${item.hash}`).join(", "));
    console.log("- mobile fingerprints:", mobile.visualResults.map((item) => `${item.key}:${item.hash}`).join(", "));
    console.log("- desktop accessory pixels:", desktop.finalPixels.overlayOpaque);
    console.log("- mobile accessory pixels:", mobile.finalPixels.overlayOpaque);
  } finally {
    try { socket?.close(); } catch {}
    chrome.kill("SIGTERM");
    await sleep(200);
    if (!chrome.killed) chrome.kill("SIGKILL");
  }
}

main().catch((error) => {
  console.error("All-options realtime production acceptance failed:", error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});