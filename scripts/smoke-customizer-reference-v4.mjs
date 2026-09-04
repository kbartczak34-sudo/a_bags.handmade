import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const productionUrl = process.env.ABAGS_PRODUCTION_URL || "https://abagshandmade.pl";
const outputDir = process.env.ABAGS_VISUAL_QA_DIR || "";
const port = Number(process.env.ABAGS_V4_CHROME_DEBUG_PORT || 9555);
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

const V4_DIALOG = `([...document.querySelectorAll('.abags-vc-dialog')].find((dialog)=>dialog.classList.contains('abags-reference-layout-v4') && dialog.dataset.abagsReferenceLayout==='v3') || null)`;

async function main() {
  const binary = chromeBinary();
  const url = `${productionUrl}${productionUrl.includes("?") ? "&" : "?"}abags-v4-qa=${Date.now()}`;
  const chrome = spawn(binary, [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-background-networking",
    "--disable-default-apps",
    "--no-first-run",
    "--enable-webgl",
    "--use-angle=swiftshader",
    `--remote-debugging-port=${port}`,
    "about:blank",
  ], { stdio: ["ignore", "pipe", "pipe"] });

  let socket;
  let capture = async () => 0;
  let evaluate = async () => null;

  try {
    await waitJson(`http://127.0.0.1:${port}/json/version`);
    const target = await waitJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
    const cdp = await connectCdp(target.webSocketDebuggerUrl);
    socket = cdp.socket;
    const send = cdp.send;

    evaluate = async (expression) => valueOf(await send("Runtime.evaluate", {
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

    capture = async (name) => {
      const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
      if (outputDir) {
        mkdirSync(outputDir, { recursive: true });
        writeFileSync(join(outputDir, name), Buffer.from(shot.data, "base64"));
      }
      return shot.data.length;
    };

    const openCustomizer = async () => {
      const opened = await evaluate(`(() => {
        window.scrollTo(0,0);
        const button=[...document.querySelectorAll('button')].find((node)=>node.textContent?.includes('Uruchom konfigurator'));
        if(!button)return false;
        button.click();
        return true;
      })()`);
      if (!opened) throw new Error("Could not open the visual customizer.");
      await waitFor(`Boolean(${V4_DIALOG})`, "Reference Layout V4");
      await waitFor(`(() => {
        const dialog=${V4_DIALOG};
        if(!dialog)return false;
        const eyebrow=dialog.querySelector('.abags-vc-header .abags-v3-eyebrow')?.textContent||'';
        return dialog.dataset.abagsV3HeaderLocked==='true'
          && dialog.dataset.abagsReferenceV4==='true'
          && eyebrow.includes('A-BAGS VISUAL CUSTOMIZER');
      })()`, "stable V4 header");
    };

    const choose = async (key, value) => {
      const ok = await evaluate(`(() => {
        const dialog=${V4_DIALOG};
        const selector='button[data-builder-key=${JSON.stringify(key)}][data-builder-value=${JSON.stringify(value)}]';
        const button=dialog?.querySelector(selector);
        if(!button || button.disabled)return false;
        button.click();
        return true;
      })()`);
      if (!ok) throw new Error(`Missing builder choice ${key}=${value}.`);
      await sleep(120);
    };

    const applyQaConfiguration = async () => {
      await choose("family", "tote");
      await choose("color", "#E4A9B5");
      await choose("stitch", "herringbone");
      await choose("flap", "crochet");
      await choose("handles", "wood-light");
      await choose("strap", "leather");
      await choose("hardware", "gold");
      await choose("accent", "scarf");
      await waitFor(`(() => {
        const stage=${V4_DIALOG}?.querySelector('.abags-bag-builder-stage');
        return stage?.dataset.color==='#E4A9B5'
          && (stage?.dataset.abagsPro3dReady==='true' || stage?.dataset.abagsCanvas3dReady==='true');
      })()`, "configured interactive renderer");
    };

    const showApprovedFirstStep = async () => {
      const set = await evaluate(`(() => {
        const dialog=${V4_DIALOG};
        const stage=dialog?.querySelector('.abags-bag-builder-stage');
        if(!dialog||!stage)return false;
        stage.dataset.abagsRefStep='1';
        return true;
      })()`);
      if (!set) throw new Error("Could not select approved Fason step.");
      await waitFor(`(() => {
        const dialog=${V4_DIALOG};
        const family=dialog?.querySelector('.abags-builder-group[data-v4-key="family"]');
        const options=family?.querySelector('.abags-builder-options');
        return dialog?.dataset.v4Step==='1' && options && getComputedStyle(options).display!=='none';
      })()`, "approved Fason step");
    };

    const rendererContract = `(() => {
      const dialog=${V4_DIALOG};
      const stage=dialog?.querySelector('.abags-bag-builder-stage');
      if(!dialog||!stage)return null;
      const ready=stage.dataset.abagsPro3dReady==='true' || stage.dataset.abagsCanvas3dReady==='true';
      const baseSvg=stage.querySelector(':scope > svg');
      const baseStyle=baseSvg?getComputedStyle(baseSvg):null;
      const visibleControl=[
        ...stage.querySelectorAll('.abags-pro3d-chip,.abags-canvas3d-chip,.abags-pro3d-hint,.abags-canvas3d-hint,.abags-pro3d-view-controls,.abags-canvas3d-views,.abags-pro3d-zoom,.abags-canvas3d-zoom')
      ].find((node)=>{
        const style=getComputedStyle(node);
        return style.display!=='none' && style.visibility!=='hidden' && Number(style.opacity)>0.05;
      });
      return {
        ready,
        baseHidden:!baseSvg || baseStyle?.visibility==='hidden' || Number(baseStyle?.opacity||1)===0,
        controlsQuiet:!visibleControl,
        renderer:stage.dataset.abagsPro3dReady==='true'?'pro3d':stage.dataset.abagsCanvas3dReady==='true'?'canvas3d':'none',
      };
    })()`;

    await send("Runtime.enable");
    await send("Page.enable");

    // Desktop acceptance.
    await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await send("Page.reload", { ignoreCache: true });
    await waitFor("document.readyState === 'complete'", "desktop document load");
    await evaluate("document.fonts?.ready ? document.fonts.ready.then(()=>true) : true");
    await waitFor("Boolean(document.querySelector('#personalizacja'))", "desktop personalization entry");
    await openCustomizer();
    await applyQaConfiguration();
    await showApprovedFirstStep();

    const desktop = await evaluate(`(() => {
      const dialog=${V4_DIALOG};
      const root=dialog?.closest('.abags-vc-layer-root');
      const controls=dialog?.querySelector('[data-abags-exact-live]');
      const preview=dialog?.querySelector('.abags-vc-preview-column');
      const rail=dialog?.querySelector('.abags-ref-step-rail');
      if(!dialog||!root||!controls||!preview||!rail)return null;
      const d=dialog.getBoundingClientRect(),c=controls.getBoundingClientRect(),p=preview.getBoundingClientRect();
      return {
        width:Math.round(d.width),height:Math.round(d.height),top:Math.round(d.top),left:Math.round(d.left),
        controlsLeft:Math.round(c.left),previewLeft:Math.round(p.left),previewWidth:Math.round(p.width),
        railDisplay:getComputedStyle(rail).display,rootPosition:getComputedStyle(root).position,
        step:dialog.dataset.v4Step||'',
      };
    })()`);
    const desktopRenderer = await evaluate(rendererContract);
    if (!desktop || desktop.width < 1200 || desktop.height < 800 || desktop.top < 0 || desktop.top > 60 || desktop.previewLeft <= desktop.controlsLeft || desktop.previewWidth < 500 || desktop.railDisplay === "none" || desktop.rootPosition !== "fixed" || desktop.step !== "1") {
      throw new Error(`Desktop V4 layout mismatch: ${JSON.stringify(desktop)}`);
    }
    if (!desktopRenderer?.ready || !desktopRenderer.baseHidden || !desktopRenderer.controlsQuiet) {
      throw new Error(`Desktop V4 renderer contract mismatch: ${JSON.stringify(desktopRenderer)}`);
    }
    const desktopBytes = await capture("customizer-desktop-v4.png");

    // Mobile acceptance is a fresh page at the real target viewport.
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await send("Page.reload", { ignoreCache: true });
    await waitFor("document.readyState === 'complete'", "mobile document load");
    await evaluate("document.fonts?.ready ? document.fonts.ready.then(()=>true) : true");
    await evaluate("window.scrollTo(0,0); true");
    await waitFor("window.scrollY === 0", "mobile scroll reset");
    await waitFor("Boolean(document.querySelector('#personalizacja'))", "mobile personalization entry");
    await openCustomizer();
    await applyQaConfiguration();
    await showApprovedFirstStep();

    const mobile = await evaluate(`(() => {
      const dialog=${V4_DIALOG};
      const root=dialog?.closest('.abags-vc-layer-root');
      const header=dialog?.querySelector('.abags-vc-header');
      const preview=dialog?.querySelector('.abags-vc-preview-column');
      const mount=dialog?.querySelector('[data-abags-exact-live]');
      const rail=dialog?.querySelector('.abags-ref-step-rail');
      const inspirations=dialog?.querySelector('.abags-ref-inspirations');
      const title=dialog?.querySelector('.abags-v3-title');
      const familyOptions=dialog?.querySelector('.abags-builder-group[data-v4-key="family"] .abags-builder-options');
      if(!dialog||!root||!header||!preview||!mount||!rail||!inspirations||!title||!familyOptions)return null;
      const d=dialog.getBoundingClientRect(),h=header.getBoundingClientRect(),p=preview.getBoundingClientRect(),m=mount.getBoundingClientRect(),i=inspirations.getBoundingClientRect();
      const grid=getComputedStyle(familyOptions);
      return {
        width:Math.round(d.width),height:Math.round(d.height),top:Math.round(d.top),left:Math.round(d.left),
        headerHeight:Math.round(h.height),headerBottom:Math.round(h.bottom),previewTop:Math.round(p.top),previewHeight:Math.round(p.height),
        mountTop:Math.round(m.top),inspirationsHeight:Math.round(i.height),railDisplay:getComputedStyle(rail).display,
        rootPosition:getComputedStyle(root).position,titleDisplay:getComputedStyle(title).display,scrollY:Math.round(window.scrollY),
        step:dialog.dataset.v4Step||'',familyDisplay:grid.display,familyColumns:grid.gridTemplateColumns,
      };
    })()`);
    const mobileRenderer = await evaluate(rendererContract);
    if (!mobile || mobile.width < 388 || mobile.width > 392 || mobile.height < 840 || Math.abs(mobile.top) > 2 || Math.abs(mobile.left) > 2 || mobile.rootPosition !== "fixed" || mobile.scrollY !== 0 || mobile.headerHeight < 48 || mobile.headerHeight > 55 || mobile.previewTop < mobile.headerBottom - 2 || mobile.previewTop > 70 || mobile.previewHeight < 300 || mobile.previewHeight > 345 || mobile.mountTop <= mobile.previewTop || mobile.mountTop > 430 || mobile.inspirationsHeight < 60 || mobile.inspirationsHeight > 75 || mobile.railDisplay !== "none" || mobile.titleDisplay !== "none" || mobile.step !== "1" || mobile.familyDisplay !== "grid" || mobile.familyColumns.split(" ").length < 3) {
      throw new Error(`Mobile V4 layout mismatch: ${JSON.stringify(mobile)}`);
    }
    if (!mobileRenderer?.ready || !mobileRenderer.baseHidden || !mobileRenderer.controlsQuiet) {
      throw new Error(`Mobile V4 renderer contract mismatch: ${JSON.stringify(mobileRenderer)}`);
    }

    await sleep(300);
    const mobileBytes = await capture("customizer-mobile-v4.png");
    console.log("Reference Layout V4 production acceptance passed:", JSON.stringify({
      desktop,
      mobile,
      desktopRenderer,
      mobileRenderer,
      desktopScreenshotBytes: desktopBytes,
      mobileScreenshotBytes: mobileBytes,
      screenshots: Boolean(outputDir),
    }));
  } catch (error) {
    try {
      await capture("customizer-failure-v4.png");
    } catch {}
    throw error;
  } finally {
    try { socket?.close(); } catch {}
    chrome.kill("SIGTERM");
    await sleep(250);
    if (chrome.exitCode === null) chrome.kill("SIGKILL");
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(`Reference Layout V4 production acceptance failed: ${error instanceof Error ? error.stack || error.message : String(error)}`);
  process.exit(1);
});
