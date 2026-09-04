"use client";

import { useEffect } from "react";

export default function BagBuilderViewSync() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const button = (event.target as Element | null)?.closest?.("button");
      if (!(button instanceof HTMLButtonElement)) return;
      const label = button.getAttribute("aria-label") || "";
      if (label !== "Oddal model" && label !== "Przybliż model") return;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const stage = button.closest<HTMLElement>(".abags-bag-builder-stage");
          const range = stage?.querySelector<HTMLInputElement>(
            '.abags-fidelity3d-zoom input[type="range"], .abags-pro3d-zoom input[type="range"], .abags-canvas3d-zoom input[type="range"]',
          );
          if (!range) return;
          range.dispatchEvent(new Event("input", { bubbles: true }));
        });
      });
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
