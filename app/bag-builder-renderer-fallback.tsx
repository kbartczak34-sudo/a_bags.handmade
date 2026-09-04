"use client";

import BagBuilderPremiumCanvas3D from "./bag-builder-premium-canvas3d";
import BagBuilderCanvas3DTouchRescue from "./bag-builder-canvas3d-touch-rescue";

export default function BagBuilderRendererFallback() {
  return <>
    <BagBuilderPremiumCanvas3D />
    <BagBuilderCanvas3DTouchRescue />
    <style jsx global>{`
      /* Fidelity3D remains primary where WebGL is genuinely available. On constrained
         Android/WebView/headless environments the premium photo-textured canvas is
         the deterministic software renderer. */
      .abags-target-layout-v2 .abags-bag-builder-stage.abags-canvas3d-active:not(.abags-pro3d-active) > .abags-canvas3d-layer {
        display: block !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
        inset: 0 !important;
        z-index: 4 !important;
        border-radius: inherit !important;
      }

      .abags-target-layout-v2 .abags-bag-builder-stage.abags-canvas3d-active:not(.abags-pro3d-active) > .abags-canvas3d-canvas,
      .abags-target-layout-v2 .abags-bag-builder-stage.abags-canvas3d-active:not(.abags-pro3d-active) .abags-canvas3d-canvas {
        display: block !important;
        width: 100% !important;
        height: 100% !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
        touch-action: none !important;
      }

      .abags-target-layout-v2 .abags-bag-builder-stage.abags-pro3d-active > .abags-canvas3d-layer {
        display: none !important;
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }

      .abags-target-layout-v2 .abags-bag-builder-stage.abags-canvas3d-active:not(.abags-pro3d-active) .abags-canvas3d-chip {
        top: 16px !important;
        left: 16px !important;
        transform: none !important;
        max-width: 52% !important;
        padding: 9px 12px !important;
        background: rgba(255, 250, 248, .92) !important;
        color: #5a4245 !important;
        border: 1px solid rgba(90, 66, 69, .1) !important;
        font-size: 9px !important;
        backdrop-filter: blur(12px) !important;
      }

      .abags-target-layout-v2 .abags-bag-builder-stage.abags-canvas3d-active:not(.abags-pro3d-active) .abags-canvas3d-views {
        top: 16px !important;
        right: 16px !important;
        padding: 5px !important;
        border-radius: 999px !important;
        background: rgba(255, 250, 248, .92) !important;
        border: 1px solid rgba(90, 66, 69, .1) !important;
        backdrop-filter: blur(12px) !important;
      }

      .abags-target-layout-v2 .abags-bag-builder-stage.abags-canvas3d-active:not(.abags-pro3d-active) .abags-canvas3d-views button {
        min-width: 58px !important;
        min-height: 34px !important;
        font-size: 10px !important;
      }

      .abags-target-layout-v2 .abags-bag-builder-stage.abags-canvas3d-active:not(.abags-pro3d-active) .abags-canvas3d-zoom {
        left: 18px !important;
        right: auto !important;
        bottom: 72px !important;
        width: min(86%, 520px) !important;
        transform: none !important;
        z-index: 8 !important;
      }

      .abags-target-layout-v2 .abags-bag-builder-stage.abags-canvas3d-active:not(.abags-pro3d-active) .abags-canvas3d-hint {
        display: none !important;
      }

      @media (max-width: 820px) {
        .abags-target-layout-v2 .abags-bag-builder-stage.abags-canvas3d-active:not(.abags-pro3d-active) .abags-canvas3d-chip {
          top: 12px !important;
          left: 12px !important;
          max-width: 58% !important;
          padding: 7px 9px !important;
          font-size: 8px !important;
        }

        .abags-target-layout-v2 .abags-bag-builder-stage.abags-canvas3d-active:not(.abags-pro3d-active) .abags-canvas3d-views {
          top: 10px !important;
          right: 10px !important;
        }

        .abags-target-layout-v2 .abags-bag-builder-stage.abags-canvas3d-active:not(.abags-pro3d-active) .abags-canvas3d-views button {
          min-width: 48px !important;
          min-height: 32px !important;
          font-size: 9px !important;
        }

        .abags-target-layout-v2 .abags-bag-builder-stage.abags-canvas3d-active:not(.abags-pro3d-active) .abags-canvas3d-zoom {
          left: 12px !important;
          right: 12px !important;
          bottom: 58px !important;
          width: auto !important;
          grid-template-columns: 36px minmax(92px, 1fr) 36px 48px !important;
          gap: 5px !important;
          padding: 5px !important;
        }
      }
    `}</style>
  </>;
}
