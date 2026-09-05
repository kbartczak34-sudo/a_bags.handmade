"use client";

import { useEffect } from "react";

const STITCH_LABEL = "Ścieg szydełkowy";
const STITCH_TITLE = "3. Ścieg szydełkowy";
const STITCH_HELP = "Wybierz strukturę ściegu szydełkowego";

function applyCrochetTerminology() {
  const dialog = document.querySelector<HTMLElement>(".abags-vc-dialog.abags-vc-builder-active");
  if (!dialog) return;

  const stitchButton = dialog.querySelector<HTMLButtonElement>('button[data-builder-key="stitch"]');
  const stitchGroup = stitchButton?.closest<HTMLElement>(".abags-builder-group") ?? null;
  const legend = stitchGroup?.querySelector<HTMLElement>("legend") ?? null;
  if (legend) {
    legend.dataset.v3Label = STITCH_LABEL;
    legend.setAttribute("aria-label", STITCH_LABEL);
  }

  const stage = dialog.querySelector<HTMLElement>(".abags-bag-builder-stage");
  const step = Number(stage?.dataset.abagsRefStep || dialog.dataset.v4Step || dialog.dataset.referenceStep || "0");
  if (step === 3) {
    const heading = dialog.querySelector<HTMLElement>(".abags-builder-heading h3");
    const help = dialog.querySelector<HTMLElement>(".abags-builder-heading p:last-child");
    heading?.setAttribute("aria-label", STITCH_TITLE);
    help?.setAttribute("aria-label", STITCH_HELP);
  }

  dialog.dataset.abagsCrochetTerminology = "ready";
}

export default function BagBuilderCrochetTerminologyGuard() {
  useEffect(() => {
    let frame = 0;
    const requestSync = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = window.requestAnimationFrame(() => {
          frame = 0;
          applyCrochetTerminology();
        });
      });
    };

    requestSync();
    const observer = new MutationObserver(requestSync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-abags-ref-step", "data-v4-step", "data-reference-step", "data-stitch"],
    });

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      document.querySelectorAll<HTMLElement>("[data-abags-crochet-terminology]").forEach((dialog) => {
        delete dialog.dataset.abagsCrochetTerminology;
      });
    };
  }, []);

  return <style jsx global>{`
    .abags-vc-dialog.abags-vc-builder-active .abags-builder-group[data-v3-key="stitch"] legend::after {
      content: "Ścieg szydełkowy" !important;
    }

    .abags-vc-dialog.abags-reference-layout-v4[data-v4-step="3"] .abags-builder-heading h3 {
      font-size: 0 !important;
    }
    .abags-vc-dialog.abags-reference-layout-v4[data-v4-step="3"] .abags-builder-heading h3::after {
      content: "3. Ścieg szydełkowy" !important;
      font-family: var(--font-display), Georgia, serif !important;
      font-size: 24px !important;
      font-weight: 500 !important;
      line-height: 1.03 !important;
      color: #49363a !important;
    }

    .abags-vc-dialog.abags-reference-layout-v4[data-v4-step="3"] .abags-builder-heading p:last-child {
      font-size: 0 !important;
    }
    .abags-vc-dialog.abags-reference-layout-v4[data-v4-step="3"] .abags-builder-heading p:last-child::after {
      content: "Wybierz strukturę ściegu szydełkowego" !important;
      color: rgba(73,54,58,.62) !important;
      font-size: 10px !important;
      line-height: 1.4 !important;
    }
  `}</style>;
}
