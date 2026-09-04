"use client";

import { useEffect } from "react";

const MAX_ATTEMPTS = 12;

function inspectWebGl(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl");
  if (!gl || gl.isContextLost()) return { healthy: false, renderedPixels: false, reason: "context-unavailable" };
  const width = gl.drawingBufferWidth;
  const height = gl.drawingBufferHeight;
  if (width < 16 || height < 16) return { healthy: false, renderedPixels: false, reason: "buffer-too-small" };

  let renderedPixels = 0;
  const pixel = new Uint8Array(4);
  try {
    // Scan a coarse grid instead of a few fixed points. The bag silhouette changes by family,
    // rotation and viewport, so a sparse fixed-point probe can miss a perfectly valid frame.
    for (let iy = 1; iy <= 9; iy += 1) {
      for (let ix = 1; ix <= 9; ix += 1) {
        gl.readPixels(
          Math.max(0, Math.min(width - 1, Math.floor((width * ix) / 10))),
          Math.max(0, Math.min(height - 1, Math.floor((height * iy) / 10))),
          1,
          1,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixel,
        );
        if (pixel[3] > 8) renderedPixels += 1;
      }
    }
  } catch {
    return { healthy: false, renderedPixels: false, reason: "readback-failed" };
  }

  // Some Chromium/Android compositors discard the default framebuffer before a later readback
  // when preserveDrawingBuffer is false. A live linked program + non-lost, correctly-sized WebGL
  // context after Fidelity3D's redraw is therefore the secondary proof of a valid render surface.
  // The production browser acceptance still captures and inspects the real visible canvas.
  const program = gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram | null;
  const error = gl.getError();
  const healthy = Boolean(program) && error === gl.NO_ERROR;
  return {
    healthy,
    renderedPixels: renderedPixels >= 2,
    reason: renderedPixels >= 2 ? "rendered-pixels" : healthy ? "healthy-webgl-frame" : `webgl-error-${error}`,
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

      const canvas = stage.querySelector<HTMLCanvasElement>(".abags-fidelity3d-canvas");
      const rendererError = stage.dataset.abagsFidelity3dError || "";
      if (!canvas || stage.dataset.abagsFidelity3dReady !== "variable-depth-v1") {
        if (attempt < MAX_ATTEMPTS) {
          timer = window.setTimeout(() => validate(attempt + 1), 110);
        } else {
          markFallback(rendererError ? `renderer-error:${rendererError}` : "webgl-not-ready");
        }
        return;
      }

      stage.dataset.abagsFinal3d = "probing";
      stage.dataset.abagsFinal3dReason = "verifying-frame";

      // Fidelity3D schedules its own redraw from this event. Two animation frames let React state,
      // WebGL drawing and the browser compositor settle before the final renderer is promoted.
      window.dispatchEvent(new Event("resize"));
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        secondFrame = window.requestAnimationFrame(() => {
          secondFrame = 0;
          if (!stage) return;
          const inspection = inspectWebGl(canvas);
          if (inspection.renderedPixels || inspection.healthy) {
            stage.dataset.abagsFinal3d = "ready";
            stage.dataset.abagsFinal3dReason = inspection.reason;
            stage.dataset.abagsFinal3dSignature = signature(stage);
            stage.classList.add("abags-final3d-ready");
            return;
          }
          if (attempt < MAX_ATTEMPTS) timer = window.setTimeout(() => validate(attempt + 1), 110);
          else markFallback(inspection.reason || "no-rendered-frame");
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

    const attachStage = (next: HTMLElement | null) => {
      if (next === stage) {
        bindCanvasEvents();
        validate();
        return;
      }
      stageObserver?.disconnect();
      clearPending();
      stage = next;
      boundCanvas = null;
      if (!stage) return;

      stageObserver = new MutationObserver(() => {
        bindCanvasEvents();
        validate();
      });
      stageObserver.observe(stage, {
        attributes: true,
        childList: true,
        subtree: true,
        attributeFilter: [
          "data-family", "data-color", "data-stitch", "data-flap", "data-handles",
          "data-strap", "data-hardware", "data-accent", "data-abags-fidelity3d-ready",
          "data-abags-fidelity3d-error",
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
