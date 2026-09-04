"use client";

import { useEffect } from "react";

const TARGET_MOBILE_ZOOM = 1.16;
const FIT_VERSION = "v1";

function setNativeRangeValue(input: HTMLInputElement, value: number) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) return false;
  setter.call(input, String(value));
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function applyPremiumFit() {
  if (!window.matchMedia("(max-width: 980px)").matches) return;

  document.querySelectorAll<HTMLElement>(".abags-vc-dialog.abags-reference-layout-v4").forEach((dialog) => {
    const stage = dialog.querySelector<HTMLElement>(".abags-bag-builder-stage");
    if (!stage) return;
    if (dialog.dataset.abagsPhotoTrue === "active" || stage.dataset.abagsPhotoTrue === "active") return;
    if (!stage.dataset.family || stage.dataset.abagsFinal3d !== "ready") return;
    if (stage.dataset.abagsMobilePremiumFit === FIT_VERSION) return;

    const range = stage.querySelector<HTMLInputElement>('.abags-fidelity3d-zoom input[type="range"]');
    if (!range) return;

    const current = Number(range.value);
    if (!Number.isFinite(current)) return;

    stage.dataset.abagsMobilePremiumFit = FIT_VERSION;
    if (current >= TARGET_MOBILE_ZOOM - 0.01) return;
    setNativeRangeValue(range, TARGET_MOBILE_ZOOM);
  });
}

export default function BagBuilderCustomerPremiumFit() {
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        applyPremiumFit();
      });
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "data-family", "data-abags-final3d", "data-abags-photo-true"],
    });
    window.addEventListener("resize", schedule);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
