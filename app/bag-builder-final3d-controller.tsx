"use client";

import { useEffect } from "react";

const MAX_ATTEMPTS = 8;

function sampleRenderedPixels(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl");
  if (!gl || gl.isContextLost()) return false;
  const width = gl.drawingBufferWidth;
  const height = gl.drawingBufferHeight;
  if (width < 16 || height < 16) return false;

  const points = [
    [0.5, 0.5],
    [0.45, 0.5],
    [0.55, 0.5],
    [0.5, 0.43],
    [0.5, 0.57],
    [0.4, 0.55],
    [0.6, 0.55],
  ];
  const pixel = new Uint8Array(4);

  try {
    for (const [px, py] of points) {
      gl.readPixels(
        Math.max(0, Math.min(width - 1, Math.floor(width * px))),
        Math.max(0, Math.min(height - 1, Math.floor(height * py))),
        1,
        1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixel,
      );
      if (pixel[3] > 8) return true;
    }
  } catch {
    return false;
  }
  return false;
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
    let timer = 0;
    let boundCanvas: HTMLCanvasElement | null = null;

    const clearPending = () => {
      if (frame) window.cancelAnimationFrame(frame);
      if (timer) window.clearTimeout(timer);
      frame = 0;
      timer = 0;
    };

    const markFallback = (reason: string) => {
      if (!stage) return;
      stage.dataset.abagsFinal3d = "fallback";
      stage.dataset.abagsFinal3dReason = reason;
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
      if (!canvas || stage.dataset.abagsFidelity3dReady !== "variable-depth-v1") {
        if (attempt < MAX_ATTEMPTS) timer = window.setTimeout(() => validate(attempt + 1), 90);
        else markFallback("webgl-not-ready");
        return;
      }

      stage.dataset.abagsFinal3d = "probing";
      stage.dataset.abagsFinal3dReason = "verifying-frame";

      // Fidelity3D redraws on resize. Registering our RAF after the event guarantees
      // that pixel verification runs after its redraw callback in the same frame.
      window.dispatchEvent(new Event("resize"));
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (!stage) return;
        if (sampleRenderedPixels(canvas)) {
          stage.dataset.abagsFinal3d = "ready";
          stage.dataset.abagsFinal3dReason = "rendered-pixels";
          stage.dataset.abagsFinal3dSignature = signature(stage);
          stage.classList.add("abags-final3d-ready");
          return;
        }
        if (attempt < MAX_ATTEMPTS) timer = window.setTimeout(() => validate(attempt + 1), 90);
        else markFallback("no-rendered-pixels");
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
