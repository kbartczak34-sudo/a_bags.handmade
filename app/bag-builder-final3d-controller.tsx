"use client";

import { useEffect } from "react";

const MAX_ATTEMPTS = 20;
const REQUIRED_RENDERER = "abags-fidelity-v3";
const PAINT_METADATA = new Set(["data-abags-fidelity3d-frame", "data-abags-fidelity3d-frame-at"]);

type PixelInspection = {
  ok: boolean;
  reason: string;
  opaqueSamples: number;
  chromaSamples: number;
  lumaSpread: number;
  colorRequired: boolean;
  colorSamples: number;
  hueMatches: number;
  expectedHue: number | null;
  averageHueDelta: number | null;
};

type HueSample = {
  hue: number;
  saturation: number;
};

function emptyInspection(reason: string): PixelInspection {
  return {
    ok: false,
    reason,
    opaqueSamples: 0,
    chromaSamples: 0,
    lumaSpread: 0,
    colorRequired: false,
    colorSamples: 0,
    hueMatches: 0,
    expectedHue: null,
    averageHueDelta: null,
  };
}

function inspectWebGlContext(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl");
  if (!gl || gl.isContextLost()) return { ok: false, reason: "context-unavailable" };
  if (gl.drawingBufferWidth < 16 || gl.drawingBufferHeight < 16) return { ok: false, reason: "buffer-too-small" };
  if (!gl.getParameter(gl.CURRENT_PROGRAM)) return { ok: false, reason: "no-active-program" };
  const error = gl.getError();
  if (error !== gl.NO_ERROR) return { ok: false, reason: `webgl-error-${error}` };
  return { ok: true, reason: "renderer-context-v3" };
}

function parseHexColor(value: string): [number, number, number] | null {
  const match = value.trim().match(/^#([0-9a-f]{6})$/i);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 16);
  return [(parsed >> 16) & 255, (parsed >> 8) & 255, parsed & 255];
}

function hueSample(red: number, green: number, blue: number): HueSample {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const saturation = max === 0 ? 0 : delta / max;
  if (delta === 0) return { hue: 0, saturation };

  let hue = 0;
  if (max === r) hue = 60 * (((g - b) / delta) % 6);
  else if (max === g) hue = 60 * ((b - r) / delta + 2);
  else hue = 60 * ((r - g) / delta + 4);
  if (hue < 0) hue += 360;
  return { hue, saturation };
}

function hueDistance(a: number, b: number) {
  const direct = Math.abs(a - b) % 360;
  return Math.min(direct, 360 - direct);
}

function inspectVisiblePixels(canvas: HTMLCanvasElement, expectedColor: string): PixelInspection {
  const gl = canvas.getContext("webgl");
  if (!gl || gl.isContextLost()) return emptyInspection("framebuffer-unavailable");

  const width = gl.drawingBufferWidth;
  const height = gl.drawingBufferHeight;
  if (width < 16 || height < 16) return emptyInspection("framebuffer-too-small");

  const expectedRgb = parseHexColor(expectedColor);
  const expectedSample = expectedRgb ? hueSample(...expectedRgb) : null;
  const colorRequired = Boolean(expectedSample && expectedSample.saturation >= .16);
  const expectedHue = colorRequired && expectedSample ? expectedSample.hue : null;
  const pixel = new Uint8Array(4);
  const columns = 9;
  const rows = 9;
  let opaqueSamples = 0;
  let chromaSamples = 0;
  let colorSamples = 0;
  let hueMatches = 0;
  let hueDeltaTotal = 0;
  let lumaMin = 255;
  let lumaMax = 0;

  for (let row = 0; row < rows; row += 1) {
    const ny = .08 + (.84 * row) / (rows - 1);
    const y = Math.max(0, Math.min(height - 1, Math.floor(height * ny)));
    for (let column = 0; column < columns; column += 1) {
      const nx = .08 + (.84 * column) / (columns - 1);
      const x = Math.max(0, Math.min(width - 1, Math.floor(width * nx)));
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      if (pixel[3] <= 24) continue;

      opaqueSamples += 1;
      const maxChannel = Math.max(pixel[0], pixel[1], pixel[2]);
      const minChannel = Math.min(pixel[0], pixel[1], pixel[2]);
      if (maxChannel - minChannel >= 5) chromaSamples += 1;
      const luma = Math.round(pixel[0] * .2126 + pixel[1] * .7152 + pixel[2] * .0722);
      lumaMin = Math.min(lumaMin, luma);
      lumaMax = Math.max(lumaMax, luma);

      if (expectedHue === null) continue;
      const rendered = hueSample(pixel[0], pixel[1], pixel[2]);
      if (rendered.saturation < .10) continue;
      colorSamples += 1;
      const delta = hueDistance(rendered.hue, expectedHue);
      hueDeltaTotal += delta;
      if (delta <= 48) hueMatches += 1;
    }
  }

  const error = gl.getError();
  const lumaSpread = opaqueSamples ? Math.max(0, lumaMax - lumaMin) : 0;
  const averageHueDelta = colorSamples ? Math.round((hueDeltaTotal / colorSamples) * 10) / 10 : null;
  if (error !== gl.NO_ERROR) {
    return {
      ok: false,
      reason: `readpixels-error-${error}`,
      opaqueSamples,
      chromaSamples,
      lumaSpread,
      colorRequired,
      colorSamples,
      hueMatches,
      expectedHue,
      averageHueDelta,
    };
  }

  // A non-transparent canvas is not sufficient. Several product pixels must be present and,
  // for chromatic cord colors, a meaningful share must retain the selected hue after lighting.
  const productPixelsOk = opaqueSamples >= 5;
  const minimumHueMatches = colorRequired ? Math.max(2, Math.ceil(opaqueSamples * .2)) : 0;
  const colorOk = !colorRequired || hueMatches >= minimumHueMatches;
  const ok = productPixelsOk && colorOk;
  const reason = !productPixelsOk
    ? `framebuffer-empty-${opaqueSamples}`
    : !colorOk
      ? `framebuffer-color-mismatch-${hueMatches}-${minimumHueMatches}`
      : `renderer-frame-v3-pixels-${opaqueSamples}-hue-${hueMatches}`;

  return {
    ok,
    reason,
    opaqueSamples,
    chromaSamples,
    lumaSpread,
    colorRequired,
    colorSamples,
    hueMatches,
    expectedHue,
    averageHueDelta,
  };
}

function signature(stage: HTMLElement) {
  return [
    stage.dataset.family || "",
    stage.dataset.color || "",
    stage.dataset.stitch || "",
    stage.dataset.flap || "none",
    stage.dataset.handles || "none",
    stage.dataset.strap || "none",
    stage.dataset.hardware || "gold",
    stage.dataset.accent || "none",
  ].join("|");
}

export default function BagBuilderFinal3DController() {
  useEffect(() => {
    let stage: HTMLElement | null = null;
    let stageObserver: MutationObserver | null = null;
    let bodyObserver: MutationObserver | null = null;
    let frame = 0;
    let secondFrame = 0;
    let timer = 0;
    let boundCanvas: HTMLCanvasElement | null = null;

    const clearPending = () => {
      if (frame) window.cancelAnimationFrame(frame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
      if (timer) window.clearTimeout(timer);
      frame = 0;
      secondFrame = 0;
      timer = 0;
    };

    const clearPixelDiagnostics = () => {
      if (!stage) return;
      stage.removeAttribute("data-abags-final3d-pixels");
      stage.removeAttribute("data-abags-final3d-chroma");
      stage.removeAttribute("data-abags-final3d-luma-spread");
      stage.removeAttribute("data-abags-final3d-color-samples");
      stage.removeAttribute("data-abags-final3d-hue-matches");
      stage.removeAttribute("data-abags-final3d-expected-hue");
      stage.removeAttribute("data-abags-final3d-average-hue-delta");
    };

    const markFallback = (reason: string) => {
      if (!stage) return;
      stage.dataset.abagsFinal3d = "fallback";
      stage.dataset.abagsFinal3dReason = reason.slice(0, 120);
      stage.classList.remove("abags-final3d-ready");
      stage.removeAttribute("data-abags-final3d-signature");
    };

    const recordPixels = (inspection: PixelInspection) => {
      if (!stage) return;
      stage.dataset.abagsFinal3dPixels = String(inspection.opaqueSamples);
      stage.dataset.abagsFinal3dChroma = String(inspection.chromaSamples);
      stage.dataset.abagsFinal3dLumaSpread = String(inspection.lumaSpread);
      stage.dataset.abagsFinal3dColorSamples = String(inspection.colorSamples);
      stage.dataset.abagsFinal3dHueMatches = String(inspection.hueMatches);
      if (inspection.expectedHue === null) stage.removeAttribute("data-abags-final3d-expected-hue");
      else stage.dataset.abagsFinal3dExpectedHue = String(Math.round(inspection.expectedHue * 10) / 10);
      if (inspection.averageHueDelta === null) stage.removeAttribute("data-abags-final3d-average-hue-delta");
      else stage.dataset.abagsFinal3dAverageHueDelta = String(inspection.averageHueDelta);
    };

    let validate = (attempt = 0) => {
      void attempt;
    };

    const retryOrFallback = (attempt: number, reason: string) => {
      if (attempt < MAX_ATTEMPTS) timer = window.setTimeout(() => validate(attempt + 1), 100);
      else markFallback(reason);
    };

    validate = (attempt = 0) => {
      clearPending();
      if (!stage) return;
      if (!stage.dataset.family) {
        stage.dataset.abagsFinal3d = "waiting-for-fason";
        stage.dataset.abagsFinal3dReason = "choose-family";
        stage.classList.remove("abags-final3d-ready");
        stage.removeAttribute("data-abags-final3d-signature");
        clearPixelDiagnostics();
        return;
      }

      const expectedSignature = signature(stage);
      const canvas = stage.querySelector<HTMLCanvasElement>(".abags-fidelity3d-canvas");
      const rendererError = stage.dataset.abagsFidelity3dError || "";
      const rendererReady = stage.dataset.abagsFidelity3dReady || "";
      const frameSignature = stage.dataset.abagsFidelity3dFrame || "";

      if (!canvas || rendererError || rendererReady !== REQUIRED_RENDERER || frameSignature !== expectedSignature) {
        const reason = rendererError
          ? `renderer-error:${rendererError}`
          : rendererReady !== REQUIRED_RENDERER
            ? `renderer-not-ready:${rendererReady || "missing"}`
            : "current-frame-not-drawn";
        retryOrFallback(attempt, reason);
        return;
      }

      const context = inspectWebGlContext(canvas);
      if (!context.ok) {
        retryOrFallback(attempt, context.reason);
        return;
      }

      const firstPixels = inspectVisiblePixels(canvas, stage.dataset.color || "");
      recordPixels(firstPixels);
      if (!firstPixels.ok) {
        retryOrFallback(attempt, firstPixels.reason);
        return;
      }

      stage.dataset.abagsFinal3d = "promoting";
      stage.dataset.abagsFinal3dReason = "showing-current-v3-product-frame";
      stage.dataset.abagsFinal3dSignature = expectedSignature;
      stage.classList.add("abags-final3d-ready");

      // Force both the adaptive camera redraw and a browser compositor commit before the
      // verified WebGL surface becomes the sole visible customer renderer.
      window.dispatchEvent(new Event("resize"));
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        secondFrame = window.requestAnimationFrame(() => {
          secondFrame = 0;
          if (!stage) return;
          const currentSignature = signature(stage);
          const currentFrame = stage.dataset.abagsFidelity3dFrame || "";
          const currentError = stage.dataset.abagsFidelity3dError || "";
          if (currentError || currentSignature !== expectedSignature || currentFrame !== currentSignature) {
            retryOrFallback(attempt, currentError ? `renderer-error:${currentError}` : "stale-rendered-frame");
            return;
          }

          const finalContext = inspectWebGlContext(canvas);
          if (!finalContext.ok) {
            retryOrFallback(attempt, finalContext.reason);
            return;
          }

          const finalPixels = inspectVisiblePixels(canvas, stage.dataset.color || "");
          recordPixels(finalPixels);
          if (!finalPixels.ok) {
            retryOrFallback(attempt, finalPixels.reason);
            return;
          }

          stage.dataset.abagsFinal3d = "ready";
          stage.dataset.abagsFinal3dReason = finalPixels.reason;
          stage.dataset.abagsFinal3dSignature = currentSignature;
          stage.classList.add("abags-final3d-ready");
        });
      });
    };

    const bindCanvasEvents = () => {
      if (!stage) return;
      const canvas = stage.querySelector<HTMLCanvasElement>(".abags-fidelity3d-canvas");
      if (!canvas || canvas === boundCanvas) return;
      boundCanvas = canvas;
      canvas.addEventListener("webglcontextlost", () => markFallback("context-lost"), { passive: true });
      canvas.addEventListener("webglcontextrestored", () => validate(), { passive: true });
    };

    const shouldIgnorePaintMetadata = (records: MutationRecord[]) => {
      if (!stage || !records.length) return false;
      const onlyPaintMetadata = records.every(
        (record) => record.type === "attributes" && Boolean(record.attributeName) && PAINT_METADATA.has(record.attributeName!),
      );
      if (!onlyPaintMetadata) return false;
      const state = stage.dataset.abagsFinal3d || "";
      if (state !== "promoting" && state !== "ready") return false;
      const expectedSignature = signature(stage);
      return !stage.dataset.abagsFidelity3dError
        && stage.dataset.abagsFinal3dSignature === expectedSignature
        && stage.dataset.abagsFidelity3dFrame === expectedSignature;
    };

    const attachStage = (next: HTMLElement | null) => {
      if (next === stage) {
        bindCanvasEvents();
        return;
      }
      stageObserver?.disconnect();
      clearPending();
      stage = next;
      boundCanvas = null;
      if (!stage) return;

      stageObserver = new MutationObserver((records) => {
        bindCanvasEvents();
        if (shouldIgnorePaintMetadata(records)) return;
        validate();
      });

      stageObserver.observe(stage, {
        attributes: true,
        attributeFilter: [
          "data-family", "data-color", "data-stitch", "data-flap", "data-handles",
          "data-strap", "data-hardware", "data-accent", "data-abags-fidelity3d-ready",
          "data-abags-fidelity3d-frame", "data-abags-fidelity3d-frame-at", "data-abags-fidelity3d-error",
        ],
      });
      bindCanvasEvents();
      validate();
    };

    const findStage = () => attachStage(document.querySelector<HTMLElement>(".abags-bag-builder-stage"));
    findStage();
    bodyObserver = new MutationObserver(findStage);
    bodyObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearPending();
      stageObserver?.disconnect();
      bodyObserver?.disconnect();
      if (stage) {
        stage.classList.remove("abags-final3d-ready");
        stage.removeAttribute("data-abags-final3d");
        stage.removeAttribute("data-abags-final3d-reason");
        stage.removeAttribute("data-abags-final3d-signature");
        clearPixelDiagnostics();
      }
    };
  }, []);

  return null;
}
