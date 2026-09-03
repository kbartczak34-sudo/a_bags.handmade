import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const productionUrl = process.env.ABAGS_PRODUCTION_URL || "https://abagshandmade.pl";
const outputDir = process.env.ABAGS_VISUAL_QA_DIR || "";
const port = Number(process.env.ABAGS_V3_CHROME_DEBUG_PORT || 9444);
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

const V3_DIALOG = `([...document.querySelectorAll('.abags-vc-dialog')].find((dialog)=>dialog.dataset.abagsReferenceLayout==='v3') || null)`;

async function main() {
  const binary = chromeBinary();
  const url = `${productionUrl}${productionUrl.includes("?") ? "&" : "?"}abags-v3-qa=${Date.now()}`;
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
  let diagnostics = async () => null;
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

    capture = async (name) => {
      const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
      if (outputDir) {
        mkdirSync(outputDir, { recursive: true });
        writeFileSync(join(outputDir, name), Buffer.from(shot.data, "base64"));
      }
      return shot.data.length;
    };

    diagnostics = async () => evaluate(`(() => [...document.querySelectorAll('.abags-vc-dialog')].map((dialog,index)=>{
      const rect=dialog.getBoundingClientRect();
      const style=getComputedStyle(dialog);
      return {
        index,
        className:dialog.className,
        referenceLayout:dialog.dataset.abagsReferenceLayout||'',
        headerLocked:dialog.dataset.abagsV3HeaderLocked||'',
        eyebrow:dialog.querySelector('.abags-vc-header .abags-v3-eyebrow, .abags-vc-header .eyebrow')?.textContent?.trim()||'',
        title:dialog.querySelector('.abags-vc-header .abags-v3-title, .abags-vc-header h2')?.textContent?.trim()||'',
        subtitle:dialog.querySelector('.abags-v3-subtitle')?.textContent?.trim()||'',
        display:style.display,
        visibility:style.visibility,
        opacity:style.opacity,
        width:Math.round(rect.width),
        height:Math.round(rect.height),
        top:Math.round(rect.top),
        left:Math.round(rect.left),
        hasStage:Boolean(dialog.querySelector('.abags-bag-builder-stage')),
        activeBuilder:dialog.classList.contains('abags-vc-builder-active'),
      };
    }))()`);

    await send("Runtime.enable");
    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await send("Page.reload", { ignoreCache: true });
    await waitFor("document.readyState === 'complete'", "desktop document load");
    await waitFor("Boolean(document.querySelector('#personalizacja'))", "personalization entry");

    const opened = await evaluate(`(() => {
      const button=[...document.querySelectorAll('button')].find((node)=>node.textContent?.includes('Uruchom konfigurator'));
      if(!button)return false;
      button.click();
      return true;
    })()`);
    if (!opened) throw new Error("Could not open the visual customizer.");

    await waitFor(`Boolean(${V3_DIALOG})`, "Reference Layout V3");
    const initialDiagnostics = await diagnostics();
    console.log("Reference Layout V3 DOM diagnostics:", JSON.stringify(initialDiagnostics));
    await capture("customizer-diagnostic-v3.png");

    await waitFor(`(() => {
      const dialog=${V3_DIALOG};
      if(!dialog)return false;
      const eyebrow=dialog.querySelector('.abags-vc-header .abags-v3-eyebrow')?.textContent||'';
      const title=dialog.querySelector('.abags-vc-header .abags-v3-title')?.textContent||'';
      return dialog.dataset.abagsV3HeaderLocked==='true' && eyebrow.includes('A-BAGS VISUAL CUSTOMIZER') && title.includes('Zbuduj swoją torebkę od podstaw');
    })()`, "scoped stable V3 header");
    await waitFor(`Boolean(${V3_DIALOG}?.querySelector('.abags-ref-step-rail'))`, "desktop step rail");
    await waitFor(`Boolean(${V3_DIALOG}?.querySelector('.abags-ref-layers'))`, "desktop active layers");
    await waitFor(`Boolean(${V3_DIALOG}?.querySelector('.abags-ref-inspirations'))`, "inspiration rail");
    await waitFor(`Boolean(${V3_DIALOG}?.querySelector('.abags-ref-family-photo[data-reference-id]'))`, "real A-Bags family references");

    const desktopLayout = await evaluate(`(() => {
      const dialog=${V3_DIALOG};
      const mount=dialog?.querySelector('[data-abags-exact-live]');
      const preview=dialog?.querySelector('.abags-vc-preview-column');
      const rail=dialog?.querySelector('.abags-ref-step-rail');
      if(!dialog||!mount||!preview||!rail)return null;
      const d=dialog.getBoundingClientRect(),m=mount.getBoundingClientRect(),p=preview.getBoundingClientRect();
      return {
        marker:dialog.dataset.abagsReferenceLayout,
        headerLocked:dialog.dataset.abagsV3HeaderLocked,
        eyebrow:dialog.querySelector('.abags-vc-header .abags-v3-eyebrow')?.textContent?.trim()||'',
        title:dialog.querySelector('.abags-vc-header .abags-v3-title')?.textContent?.trim()||'',
        dialogWidth:Math.round(d.width),
        dialogHeight:Math.round(d.height),
        mountLeft:Math.round(m.left),
        previewLeft:Math.round(p.left),
        previewWidth:Math.round(p.width),
        railDisplay:getComputedStyle(rail).display,
      };
    })()`);
    if (!desktopLayout || desktopLayout.marker !== "v3" || desktopLayout.headerLocked !== "true" || desktopLayout.previewLeft <= desktopLayout.mountLeft || desktopLayout.previewWidth < 500 || desktopLayout.railDisplay === "none") {
      throw new Error(`Desktop V3 layout mismatch: ${JSON.stringify(desktopLayout)}`);
    }

    const choose = async (key, value) => {
      const ok = await evaluate(`(() => {
        const dialog=${V3_DIALOG};
        const selector='button[data-builder-key=${JSON.stringify(key)}][data-builder-value=${JSON.stringify(value)}]';
        const button=dialog?.querySelector(selector);
        if(!button)return false;
        button.click();
        return true;
      })()`);
      if (!ok) throw new Error(`Missing builder choice ${key}=${value}.`);
      await sleep(110);
    };

    await choose("family", "tote");
    await choose("color", "#E4A9B5");
    await choose("stitch", "herringbone");
    await choose("flap", "crochet");
    await choose("handles", "wood-light");
    await choose("strap", "leather");
    await choose("hardware", "gold");
    await choose("accent", "scarf");

    await waitFor(`(${V3_DIALOG}?.querySelector('.abags-bag-builder-stage')?.getAttribute('data-color') || '') === '#E4A9B5'`, "pink live configuration");
    await waitFor(`(() => {
      const stage=${V3_DIALOG}?.querySelector('.abags-bag-builder-stage');
      return stage?.getAttribute('data-abags-pro3d-ready')==='true' || stage?.getAttribute('data-abags-canvas3d-ready')==='true';
    })()`, "interactive preview readiness");
    await waitFor(`Boolean(${V3_DIALOG}?.querySelector('.abags-ref-layer-row[data-ref-edit-key="accent"]'))`, "synchronized active layers");

    const saveReady = await evaluate(`(() => {
      const dialog=${V3_DIALOG};
      const button=dialog?.querySelector('[data-builder-save-state="ready"]');
      if(!button)return false;
      button.click();
      return true;
    })()`);
    if (!saveReady) throw new Error("V3 project did not reach save-ready state.");
    await waitFor("Boolean(window.localStorage.getItem('abags-bag-builder-v3'))", "saved V3 project");

    await sleep(500);
    const desktopBytes = await capture("customizer-desktop-v3.png");

    await send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await sleep(700);

    const mobileLayout = await evaluate(`(() => {
      const dialog=${V3_DIALOG};
      const preview=dialog?.querySelector('.abags-vc-preview-column');
      const mount=dialog?.querySelector('[data-abags-exact-live]');
      const rail=dialog?.querySelector('.abags-ref-step-rail');
      const inspirations=dialog?.querySelector('.abags-ref-inspirations');
      if(!dialog||!preview||!mount||!rail||!inspirations)return null;
      const d=dialog.getBoundingClientRect(),p=preview.getBoundingClientRect(),m=mount.getBoundingClientRect(),i=inspirations.getBoundingClientRect();
      return {
        width:Math.round(d.width),
        height:Math.round(d.height),
        previewTop:Math.round(p.top),
        previewHeight:Math.round(p.height),
        mountTop:Math.round(m.top),
        inspirationsHeight:Math.round(i.height),
        railDisplay:getComputedStyle(rail).display,
        header:dialog.querySelector('.abags-vc-header .abags-v3-eyebrow')?.textContent?.trim()||'',
        title:dialog.querySelector('.abags-vc-header .abags-v3-title')?.textContent?.trim()||'',
        headerLocked:dialog.dataset.abagsV3HeaderLocked||'',
      };
    })()`);
    if (!mobileLayout || mobileLayout.width > 392 || mobileLayout.height < 800 || mobileLayout.previewTop >= mobileLayout.mountTop || mobileLayout.previewHeight < 300 || mobileLayout.inspirationsHeight < 90 || mobileLayout.railDisplay !== "none" || mobileLayout.headerLocked !== "true" || !mobileLayout.header.includes("A-BAGS VISUAL CUSTOMIZER") || !mobileLayout.title.includes("Zbuduj swoją torebkę od podstaw")) {
      throw new Error(`Mobile V3 layout mismatch: ${JSON.stringify(mobileLayout)}`);
    }

    const mobileBytes = await capture("customizer-mobile-v3.png");
    console.log("Reference Layout V3 visual QA passed:", JSON.stringify({
      desktopLayout,
      mobileLayout,
      desktopScreenshotBytes: desktopBytes,
      mobileScreenshotBytes: mobileBytes,
      screenshots: Boolean(outputDir),
    }));
  } catch (error) {
    try {
      const state = await diagnostics();
      console.error("Reference Layout V3 failure DOM diagnostics:", JSON.stringify(state));
      await capture("customizer-failure-v3.png");
    } catch (diagnosticError) {
      console.error(`Could not capture V3 failure diagnostics: ${diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError)}`);
    }
    throw error;
  } finally {
    try { socket?.close(); } catch {}
    chrome.kill("SIGTERM");
    await sleep(250);
    if (chrome.exitCode === null) chrome.kill("SIGKILL");
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(`Reference Layout V3 visual QA failed: ${error instanceof Error ? error.stack || error.message : String(error)}`);
  process.exit(1);
});
