"use client";

import { useEffect } from "react";

const LEGACY_3D_CHIPS = [
  ".abags-canvas3d-chip",
  ".abags-webgl3d-chip",
  ".abags-real3d-chip",
  ".abags-pro3d-chip",
].join(",");

type SavedChromeState = {
  hidden: boolean;
  ariaHidden: string | null;
  style: string | null;
  retired: string | null;
};

function restoreChip(chip: HTMLElement, state: SavedChromeState) {
  chip.hidden = state.hidden;
  if (state.ariaHidden === null) chip.removeAttribute("aria-hidden");
  else chip.setAttribute("aria-hidden", state.ariaHidden);
  if (state.style === null) chip.removeAttribute("style");
  else chip.setAttribute("style", state.style);
  if (state.retired === null) chip.removeAttribute("data-abags-legacy-chrome");
  else chip.setAttribute("data-abags-legacy-chrome", state.retired);
}

export default function BagBuilderLegacyChromeRetirement() {
  useEffect(() => {
    const saved = new Map<HTMLElement, SavedChromeState>();
    let frame = 0;

    const restoreAll = () => {
      for (const [chip, state] of saved) {
        if (chip.isConnected) restoreChip(chip, state);
      }
      saved.clear();
    };

    const sync = () => {
      frame = 0;
      const dialog = document.querySelector<HTMLElement>(".abags-vc-dialog.abags-vc-builder-active");
      const stage = dialog?.querySelector<HTMLElement>(".abags-bag-builder-stage") ?? null;

      if (!stage || stage.dataset.abagsPhotoTrue === "active") {
        restoreAll();
        return;
      }

      for (const chip of stage.querySelectorAll<HTMLElement>(LEGACY_3D_CHIPS)) {
        if (!saved.has(chip)) {
          saved.set(chip, {
            hidden: chip.hidden,
            ariaHidden: chip.getAttribute("aria-hidden"),
            style: chip.getAttribute("style"),
            retired: chip.getAttribute("data-abags-legacy-chrome"),
          });
        }
        chip.hidden = true;
        chip.setAttribute("aria-hidden", "true");
        chip.setAttribute("data-abags-legacy-chrome", "retired");
        chip.style.setProperty("display", "none", "important");
        chip.style.setProperty("visibility", "hidden", "important");
        chip.style.setProperty("pointer-events", "none", "important");
      }

      for (const chip of [...saved.keys()]) {
        if (!chip.isConnected) saved.delete(chip);
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
      attributeFilter: ["class", "data-abags-photo-true"],
    });

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      restoreAll();
    };
  }, []);

  return null;
}
