import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const productionUrl = process.env.ABAGS_PRODUCTION_URL || "https://abagshandmade.pl";
const outputDir = process.env.ABAGS_VISUAL_QA_DIR || "";
const port = Number(process.env.ABAGS_V5_CHROME_DEBUG_PORT || 9666);
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
  const url = `${productionUrl}${productionUrl.includes("?") ? "&" : "?"}abags-photo-true-v5=${Date.now()}`;
  const chrome = spawn(binary, [
    "--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--disable-background-networking",
    "--disable-default-apps", "--no-first-run", `--remote-debugging-port=${port}`, "about:blank",
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
      let lastError;
      while (Date.now() < deadline) {
        try {
          value = await evaluate(expression);
          if (value) return value;
          lastError = undefined;
        } catch (error) {
          lastError = error;
        }
        await sleep(150);
      }
      const suffix = lastError instanceof Error ? ` Last evaluation error: ${lastError.message}` : "";
      throw new Error(`Timed out waiting for ${label}. Last value: ${JSON.stringify(value)}.${suffix}`);
    };
    const capture = async (name) => {
      const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
      if (outputDir) {
        mkdirSync(outputDir, { recursive: true });
        writeFileSync(join(outputDir, name), Buffer.from(shot.data, "base64"));
      }
      return shot.data.length;
    };
    const reloadAndWait = async (label) => {
      const token = `abags-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      await evaluate(`window.__abagsQaReloadToken=${JSON.stringify(token)}; true`);
      await send("Page.reload", { ignoreCache: true });
      await waitFor(`window.__abagsQaReloadToken !== ${JSON.stringify(token)}`, `${label} document replacement`);
      await waitFor("document.readyState === 'complete'", `${label} document load`);
      await waitFor("new URLSearchParams(window.location.search).has('abags-photo-true-v5')", `${label} Photo-True QA flag`);
    };

    const openPhotoTrue = async () => {
      await waitFor("Boolean(document.querySelector('#personalizacja'))", "personalization entry");
      const opened = await evaluate(`(() => { const b=[...document.querySelectorAll('button')].find((n)=>n.textContent?.includes('Uruchom konfigurator')); if(!b)return false; b.click(); return true; })()`);
      if (!opened) throw new Error("Could not open the customizer.");
      await waitFor("Boolean(document.querySelector('.abags-vc-dialog.abags-reference-layout-v4'))", "Reference Layout V4");
      await waitFor(`(() => {
        const d=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4');
        const s=d?.querySelector('.abags-bag-builder-stage');
        const img=d?.querySelector('.abags-photo-true-base');
        return d?.dataset.abagsPhotoTrue==='active'
          && s?.dataset.abagsPhotoTrue==='active'
          && Boolean(s?.dataset.photoProductId)
          && img?.complete && img.naturalWidth>0;
      })()`, "Photo-True V5 real product image");
      await waitFor("document.querySelectorAll('[data-photo-product-choice]').length > 0", "real store model cards");
    };

    const selectStepOne = async () => {
      await evaluate(`(() => { const s=document.querySelector('.abags-bag-builder-stage'); if(!s)return false; s.dataset.abagsRefStep='1'; return true; })()`);
      await waitFor("document.querySelector('.abags-vc-dialog.abags-reference-layout-v4')?.dataset.v4Step === '1'", "Fason step");
    };

    const contract = async () => evaluate(`(() => {
      const d=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4');
      const s=d?.querySelector('.abags-bag-builder-stage');
      const base=d?.querySelector('.abags-photo-true-base');
      const photo=d?.querySelector('.abags-photo-true-stage');
      const family=d?.querySelector('[data-photo-true-family-group="true"]');
      const familyLegend=family?.querySelector(':scope > legend');
      const modelsMount=family?.querySelector(':scope > .abags-photo-models-mount');
      if(!d||!s||!base||!photo||!family||!familyLegend||!modelsMount)return null;
      const isVisible=(node)=>{
        if(!node)return false;
        const st=getComputedStyle(node),r=node.getBoundingClientRect();
        return st.display!=='none' && st.visibility!=='hidden' && Number(st.opacity||1)>.05 && r.width>1 && r.height>1;
      };
      const visibleSynthetic=[...s.querySelectorAll(':scope > svg,.abags-pro3d-layer,.abags-canvas3d-layer')].filter(isVisible).length;
      const visibleLegacyFamilyOptions=[...d.querySelectorAll('button[data-builder-key="family"]')].filter(isVisible).length;
      const legacyInspirationsVisible=isVisible(d.querySelector('.abags-ref-inspirations'));
      const legacyFamilyLayerVisible=isVisible(d.querySelector('[data-ref-edit-key="family"]'));
      const fr=family.getBoundingClientRect(), lr=familyLegend.getBoundingClientRect(), mr=modelsMount.getBoundingClientRect();
      return {
        ready:photo.dataset.photoTrueReady==='true',
        productId:s.dataset.photoProductId||'',
        dialogProductId:d.dataset.photoProductId||'',
        baseSrc:base.getAttribute('src')||'',
        baseLoaded:base.complete && base.naturalWidth>0 && base.naturalHeight>0,
        modelCount:d.querySelectorAll('[data-photo-product-choice]').length,
        selectedCount:d.querySelectorAll('[data-photo-product-choice][aria-pressed="true"]').length,
        visibleSynthetic,
        visibleLegacyFamilyOptions,
        legacyInspirationsVisible,
        legacyFamilyLayerVisible,
        fasonGap:Math.round(mr.top-lr.bottom),
        familyHeight:Math.round(fr.height),
        note:Boolean(d.querySelector('.abags-photo-true-note')),
      };
    })()`);

    const switchModel = async () => {
      const before = await evaluate("document.querySelector('.abags-bag-builder-stage')?.dataset.photoProductId || ''");
      const switched = await evaluate(`(() => {
        const buttons=[...document.querySelectorAll('[data-photo-product-choice]')];
        const current=document.querySelector('.abags-bag-builder-stage')?.dataset.photoProductId||'';
        const next=buttons.find((b)=>b.dataset.photoProductChoice!==current);
        if(!next)return 'single';
        next.click();
        return next.dataset.photoProductChoice||'';
      })()`);
      if (switched !== "single") {
        await waitFor(`document.querySelector('.abags-bag-builder-stage')?.dataset.photoProductId===${JSON.stringify(switched)}`, "real model switch");
        await waitFor(`(() => { const img=document.querySelector('.abags-photo-true-base'); return img?.complete && img.naturalWidth>0; })()`, "switched product photograph");
        const after = await evaluate("document.querySelector('.abags-bag-builder-stage')?.dataset.photoProductId || ''");
        if (!before || before === after) throw new Error("Switching a real model did not change the Photo-True base product.");
      }
      return switched;
    };

    const assertPhotoTrueContract = (value, label) => {
      if (!value?.ready || !value.baseLoaded || !value.productId || value.productId !== value.dialogProductId || value.modelCount < 1 || value.selectedCount !== 1 || value.visibleSynthetic !== 0 || value.visibleLegacyFamilyOptions !== 0 || value.legacyInspirationsVisible || value.legacyFamilyLayerVisible || value.fasonGap < -2 || value.fasonGap > 32 || value.familyHeight > 340) {
        throw new Error(`${label} Photo-True contract mismatch: ${JSON.stringify(value)}`);
      }
    };

    await send("Runtime.enable");
    await send("Page.enable");

    // Desktop: actual store photo, real model cards, no visible synthetic/legacy model UI.
    await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await reloadAndWait("desktop");
    await openPhotoTrue();
    await selectStepOne();
    const desktopBefore = await contract();
    assertPhotoTrueContract(desktopBefore, "Desktop");
    const desktopSwitch = await switchModel();
    const desktopAfter = await contract();
    assertPhotoTrueContract(desktopAfter, "Desktop after model switch");
    const desktopBytes = await capture("customizer-desktop-v5-photo-true.png");

    // Mobile: real 390x844 viewport. The cleaned Photo-True layout intentionally uses
    // a 50px app bar and a compact ~260px photographic preview before the real-model grid.
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await reloadAndWait("mobile");
    await evaluate("window.scrollTo(0,0); true");
    await openPhotoTrue();
    await selectStepOne();
    const mobile = await evaluate(`(() => {
      const d=document.querySelector('.abags-vc-dialog.abags-reference-layout-v4');
      const h=d?.querySelector('.abags-vc-header');
      const p=d?.querySelector('.abags-vc-preview-column');
      const grid=d?.querySelector('.abags-photo-models-grid');
      const base=d?.querySelector('.abags-photo-true-base');
      if(!d||!h||!p||!grid||!base)return null;
      const dr=d.getBoundingClientRect(),hr=h.getBoundingClientRect(),pr=p.getBoundingClientRect();
      return {
        width:Math.round(dr.width),height:Math.round(dr.height),top:Math.round(dr.top),left:Math.round(dr.left),
        headerHeight:Math.round(hr.height),previewTop:Math.round(pr.top),previewHeight:Math.round(pr.height),
        gridDisplay:getComputedStyle(grid).display,gridColumns:getComputedStyle(grid).gridTemplateColumns,
        baseLoaded:base.complete&&base.naturalWidth>0,scrollY:Math.round(window.scrollY),
      };
    })()`);
    const mobileContract = await contract();
    const mobileColumnCount = mobile?.gridColumns?.split(/\s+/).filter(Boolean).length || 0;
    if (!mobile || mobile.width < 388 || mobile.width > 392 || mobile.height < 840 || mobile.height > 848 || Math.abs(mobile.top) > 2 || Math.abs(mobile.left) > 2 || mobile.headerHeight < 48 || mobile.headerHeight > 56 || mobile.previewTop < 48 || mobile.previewTop > 58 || mobile.previewHeight < 240 || mobile.previewHeight > 285 || mobile.gridDisplay !== "grid" || mobileColumnCount < 3 || !mobile.baseLoaded || mobile.scrollY !== 0 || mobileContract?.familyHeight > 255) {
      throw new Error(`Mobile Photo-True layout mismatch: ${JSON.stringify({ ...mobile, mobileColumnCount, familyHeight: mobileContract?.familyHeight, fasonGap: mobileContract?.fasonGap })}`);
    }
    assertPhotoTrueContract(mobileContract, "Mobile");
    const mobileSwitch = await switchModel();
    const mobileAfter = await contract();
    assertPhotoTrueContract(mobileAfter, "Mobile after model switch");
    const mobileBytes = await capture("customizer-mobile-v5-photo-true.png");

    console.log("Photo-True V5 production acceptance passed:", JSON.stringify({
      desktopBefore, desktopAfter, desktopSwitch, mobile, mobileContract, mobileAfter, mobileSwitch,
      desktopScreenshotBytes: desktopBytes, mobileScreenshotBytes: mobileBytes, screenshots: Boolean(outputDir),
    }));
  } finally {
    try { socket?.close(); } catch {}
    chrome.kill("SIGTERM");
    await sleep(250);
    if (chrome.exitCode === null) chrome.kill("SIGKILL");
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(`Photo-True V5 production acceptance failed: ${error instanceof Error ? error.stack || error.message : String(error)}`);
  process.exit(1);
});