"use client";

import { useEffect } from "react";

const PREMIUM_VERSION = "premium-v2";

export default function BagBuilderPremiumCompat() {
  useEffect(() => {
    let frame = 0;

    const sync = () => {
      frame = 0;
      const stage = document.querySelector<HTMLElement>(".abags-bag-builder-stage");
      if (!stage) return;

      const premiumReady = stage.dataset.abagsCanvas3dReady === PREMIUM_VERSION;
      const premiumCanvas = stage.querySelector<HTMLCanvasElement>(".abags-premium-canvas3d-layer .abags-premium-canvas3d-canvas");

      if (premiumReady && premiumCanvas) {
        stage.dataset.abagsPremiumCanvasVersion = PREMIUM_VERSION;
        stage.dataset.abagsCanvas3dReady = "true";
      }
    };

    const requestSync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(sync);
    };

    requestSync();
    const observer = new MutationObserver(requestSync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-abags-canvas3d-ready", "class"],
    });

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return <style jsx global>{`
    .abags-target-layout-v2 .abags-bag-builder-stage.abags-canvas3d-active:not(.abags-pro3d-active) > svg {
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }

    .abags-target-layout-v2 .abags-bag-builder-stage.abags-premium-canvas3d-active:not(.abags-pro3d-active) > .abags-canvas3d-layer {
      isolation: isolate !important;
    }
  `}</style>;
}
