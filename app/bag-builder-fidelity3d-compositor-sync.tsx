"use client";

import { useEffect } from "react";

const PROMOTION_ATTRIBUTES = [
  "data-abags-final3d",
  "data-abags-final3d-signature",
] as const;

export default function BagBuilderFidelity3DCompositorSync() {
  useEffect(() => {
    let stage: HTMLElement | null = null;
    let stageObserver: MutationObserver | null = null;
    let bodyObserver: MutationObserver | null = null;
    let firstFrame = 0;
    let secondFrame = 0;
    let activeSignature = "";
    let epoch = 0;

    const clearFrames = () => {
      if (firstFrame) window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
      firstFrame = 0;
      secondFrame = 0;
    };

    const resetTransform = () => {
      if (!stage) return;
      const canvas = stage.querySelector<HTMLCanvasElement>(".abags-fidelity3d-canvas");
      const layer = stage.querySelector<HTMLElement>(".abags-fidelity3d-layer");
      canvas?.style.removeProperty("transform");
      layer?.style.removeProperty("transform");
    };

    const promoteComposite = () => {
      if (!stage) return;
      const state = stage.dataset.abagsFinal3d || "";
      const signature = stage.dataset.abagsFinal3dSignature || "";

      // The compositor bridge is deliberately verifier-driven. It must never touch WebGL
      // during renderer initialization or before the controller's first successful readPixels.
      if (state !== "promoting" || !signature) {
        if (state !== "ready") {
          activeSignature = "";
          stage.removeAttribute("data-abags-fidelity3d-composite");
          resetTransform();
        }
        return;
      }

      if (activeSignature === signature && stage.dataset.abagsFidelity3dComposite === signature) return;

      const canvas = stage.querySelector<HTMLCanvasElement>(".abags-fidelity3d-canvas");
      const layer = stage.querySelector<HTMLElement>(".abags-fidelity3d-layer");
      if (!canvas || !layer) return;

      clearFrames();
      activeSignature = signature;
      stage.removeAttribute("data-abags-fidelity3d-composite");
      epoch += 1;
      canvas.dataset.abagsCompositorEpoch = String(epoch);
      layer.dataset.abagsCompositorEpoch = String(epoch);
      canvas.style.willChange = "transform";
      layer.style.willChange = "transform";
      canvas.style.backfaceVisibility = "hidden";
      layer.style.backfaceVisibility = "hidden";

      // Do not call getContext()/flush here. Chromium SwiftShader may expose an empty
      // framebuffer to readPixels when another consumer touches the context between draw and
      // validation. A compositor-only Z nudge invalidates the stale texture safely.
      const nudge = epoch % 2 === 0 ? "0.001px" : "0.002px";
      canvas.style.setProperty("transform", `translate3d(0,0,${nudge})`, "important");
      layer.style.setProperty("transform", `translate3d(0,0,${nudge})`, "important");
      void canvas.offsetWidth;

      firstFrame = window.requestAnimationFrame(() => {
        firstFrame = 0;
        secondFrame = window.requestAnimationFrame(() => {
          secondFrame = 0;
          if (!stage) return;
          if (stage.dataset.abagsFinal3d !== "promoting" || stage.dataset.abagsFinal3dSignature !== signature) return;
          canvas.style.setProperty("transform", "translate3d(0,0,0)", "important");
          layer.style.setProperty("transform", "translate3d(0,0,0)", "important");
          stage.dataset.abagsFidelity3dComposite = signature;
        });
      });
    };

    const attach = (next: HTMLElement | null) => {
      if (next === stage) return;
      stageObserver?.disconnect();
      clearFrames();
      resetTransform();
      stage = next;
      activeSignature = "";
      if (!stage) return;

      stageObserver = new MutationObserver(promoteComposite);
      stageObserver.observe(stage, {
        attributes: true,
        attributeFilter: [...PROMOTION_ATTRIBUTES],
      });
      // Intentionally no eager promoteComposite() call: the controller owns the transition
      // into `promoting` only after a verified non-empty product framebuffer exists.
    };

    const findStage = () => attach(document.querySelector<HTMLElement>(".abags-bag-builder-stage"));
    findStage();
    bodyObserver = new MutationObserver(findStage);
    bodyObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearFrames();
      stageObserver?.disconnect();
      bodyObserver?.disconnect();
      resetTransform();
      if (stage) stage.removeAttribute("data-abags-fidelity3d-composite");
    };
  }, []);

  return null;
}
