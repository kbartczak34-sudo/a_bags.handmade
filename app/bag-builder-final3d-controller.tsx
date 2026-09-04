"use client";

import { useEffect } from "react";

const MAX_ATTEMPTS = 16;
const REQUIRED_RENDERER = "variable-depth-v2";
const PAINT_METADATA = new Set(["data-abags-fidelity3d-frame", "data-abags-fidelity3d-frame-at"]);

function inspectWebGlContext(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl");
  if (!gl || gl.isContextLost()) return { ok: false, reason: "context-unavailable" };
  if (gl.drawingBufferWidth < 16 || gl.drawingBufferHeight < 16) return { ok: false, reason: "buffer-too-small" };
  if (!gl.getParameter(gl.CURRENT_PROGRAM)) return { ok: false, reason: "no-active-program" };
  const error = gl.getError();
  if (error !== gl.NO_ERROR) return { ok: false, reason: `webgl-error-${error}` };
  return { ok: true, reason: "renderer-frame-v2" };
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

    const markFallback = (reason: string) => {
      if (!stage) return;
      stage.dataset.abagsFinal3d = "fallback";
      stage.dataset.abagsFinal3dReason = reason.slice(0, 120);
      stage.classList.remove("abags-final3d-ready");
      stage.removeAttribute("data-abags-final3d-signature");
    };

    const validate = (attempt = 0) => {
      clearPending();
      if (!stage) return;
      if (!stage.dataset.family) {
        stage.dataset.abagsFinal3d = "waiting-for-fason";
        stage.dataset.abagsFinal3dReason = "choose-family";
        stage.classList.remove("abags-final3d-ready");
        stage.removeAttribute("data-abags-final3d-signature");
        return;
      }

      const expectedSignature = signature(stage);
      const canvas = stage.querySelector<HTMLCanvasElement>(".abags-fidelity3d-canvas");
      const rendererError = stage.dataset.abagsFidelity3dError || "";
      const rendererReady = stage.dataset.abagsFidelity3dReady || "";
      const frameSignature = stage.dataset.abagsFidelity3dFrame || "";

      if (!canvas || rendererError || rendererReady !== REQUIRED_RENDERER || frameSignature !== expectedSignature) {
        if (attempt < MAX_ATTEMPTS) {
          timer = window.setTimeout(() => validate(attempt + 1), 100);
        } else {
          const reason = rendererError
            ? `renderer-error:${rendererError}`
            : rendererReady !== REQUIRED_RENDERER
              ? `renderer-not-ready:${rendererReady || "missing"}`
              : "current-frame-not-drawn";
          markFallback(reason);
        }
        return;
      }

      const context = inspectWebGlContext(canvas);
      if (!context.ok) {
        if (attempt < MAX_ATTEMPTS) timer = window.setTimeout(() => validate(attempt + 1), 100);
        else markFallback(context.reason);
        return;
      }

      stage.dataset.abagsFinal3d = "promoting";
      stage.dataset.abagsFinal3dReason = "showing-current-v2-frame";
      stage.dataset.abagsFinal3dSignature = expectedSignature;
      stage.classList.add("abags-final3d-ready");

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
            if (attempt < MAX_ATTEMPTS) timer = window.setTimeout(() => validate(attempt + 1), 100);
            else markFallback(currentError ? `renderer-error:${currentError}` : "stale-rendered-frame");
            return;
          }
          const finalContext = inspectWebGlContext(canvas);
          if (!finalContext.ok) {
            if (attempt < MAX_ATTEMPTS) timer = window.setTimeout(() => validate(attempt + 1), 100);
            else markFallback(finalContext.reason);
            return;
          }
          stage.dataset.abagsFinal3d = "ready";
          stage.dataset.abagsFinal3dReason = finalContext.reason;
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
      const onlyPaintMetadata = records.every((record) => record.type === "attributes" && Boolean(record.attributeName) && PAINT_METADATA.has(record.attributeName!));
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
        // The body observer watches the whole document only so it can detect stage
        // replacement/removal. Revalidating an unchanged stage here lets unrelated
        // React DOM mutations cancel the two requestAnimationFrame promotion frames.
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
        childList: true,
        subtree: true,
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
      }
    };
  }, []);

  return null;
}
