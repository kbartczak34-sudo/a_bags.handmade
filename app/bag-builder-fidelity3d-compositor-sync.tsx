"use client";

import { useEffect } from "react";

const FRAME_ATTRIBUTES = [
  "data-abags-fidelity3d-frame",
  "data-abags-fidelity3d-frame-at",
  "data-abags-final3d",
] as const;

export default function BagBuilderFidelity3DCompositorSync() {
  useEffect(() => {
    let stage: HTMLElement | null = null;
    let stageObserver: MutationObserver | null = null;
    let bodyObserver: MutationObserver | null = null;
    let firstFrame = 0;
    let secondFrame = 0;
    let epoch = 0;

    const clearFrames = () => {
      if (firstFrame) window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
      firstFrame = 0;
      secondFrame = 0;
    };

    const forceComposite = () => {
      if (!stage) return;
      const canvas = stage.querySelector<HTMLCanvasElement>(".abags-fidelity3d-canvas");
      const layer = stage.querySelector<HTMLElement>(".abags-fidelity3d-layer");
      if (!canvas || !layer) return;

      const gl = canvas.getContext("webgl");
      gl?.flush();

      epoch += 1;
      canvas.dataset.abagsCompositorEpoch = String(epoch);
      layer.dataset.abagsCompositorEpoch = String(epoch);
      canvas.style.willChange = "transform";
      canvas.style.backfaceVisibility = "hidden";
      layer.style.willChange = "transform";
      layer.style.backfaceVisibility = "hidden";

      // Chromium/SwiftShader can keep the first uploaded WebGL texture in the compositor even
      // though readPixels already sees the newest framebuffer. A tiny Z-plane flip invalidates
      // that texture without changing the visible size or customer interaction surface.
      const nudge = epoch % 2 === 0 ? "0px" : "0.001px";
      canvas.style.transform = `translate3d(0,0,${nudge})`;
      layer.style.transform = `translate3d(0,0,${nudge})`;
      void canvas.offsetWidth;

      clearFrames();
      firstFrame = window.requestAnimationFrame(() => {
        firstFrame = 0;
        gl?.flush();
        secondFrame = window.requestAnimationFrame(() => {
          secondFrame = 0;
          if (!stage) return;
          canvas.style.transform = "translate3d(0,0,0)";
          layer.style.transform = "translate3d(0,0,0)";
          stage.dataset.abagsFidelity3dComposite = stage.dataset.abagsFidelity3dFrameAt || String(Date.now());
        });
      });
    };

    const attach = (next: HTMLElement | null) => {
      if (next === stage) {
        forceComposite();
        return;
      }

      stageObserver?.disconnect();
      clearFrames();
      stage = next;
      if (!stage) return;

      stageObserver = new MutationObserver(() => forceComposite());
      stageObserver.observe(stage, {
        attributes: true,
        attributeFilter: [...FRAME_ATTRIBUTES],
        childList: true,
        subtree: true,
      });
      forceComposite();
    };

    const findStage = () => attach(document.querySelector<HTMLElement>(".abags-bag-builder-stage"));
    findStage();
    bodyObserver = new MutationObserver(findStage);
    bodyObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearFrames();
      stageObserver?.disconnect();
      bodyObserver?.disconnect();
      if (stage) stage.removeAttribute("data-abags-fidelity3d-composite");
    };
  }, []);

  return null;
}
