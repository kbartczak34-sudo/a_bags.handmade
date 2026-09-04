"use client";

import { useEffect } from "react";

const LEGACY_3D_CHIP_SELECTOR = [
  ".abags-canvas3d-chip",
  ".abags-webgl3d-chip",
  ".abags-real3d-chip",
  ".abags-pro3d-chip",
].join(",");

function retireLegacy3dChips() {
  const dialog = document.querySelector<HTMLElement>(".abags-vc-dialog.abags-vc-builder-active");
  const stage = dialog?.querySelector<HTMLElement>(".abags-bag-builder-stage") ?? null;
  if (!stage) return;

  stage.querySelectorAll<HTMLElement>(LEGACY_3D_CHIP_SELECTOR).forEach((chip) => chip.remove());
}

export default function BagBuilderCustomerLegacyChipRetirement() {
  useEffect(() => {
    let frame = 0;

    const requestRetirement = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        retireLegacy3dChips();
      });
    };

    requestRetirement();
    const observer = new MutationObserver(requestRetirement);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
