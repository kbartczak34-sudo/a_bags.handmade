"use client";

import { useEffect } from "react";
import { EXACT_ATELIER_LIBRARY } from "../lib/exact-customizer-library";

type Config = Record<string, string>;

function readConfig(stage: HTMLElement): Config {
  return {
    family: stage.dataset.family || "",
    color: stage.dataset.color || "",
    stitch: stage.dataset.stitch || "",
    flap: stage.dataset.flap || "none",
    handles: stage.dataset.handles || "none",
    strap: stage.dataset.strap || "none",
    hardware: stage.dataset.hardware || "gold",
    accent: stage.dataset.accent || "none",
  };
}

function sameConfig(a: Config, b: Config) {
  return Object.keys(a).every((key) => a[key] === b[key]);
}

function fileNameFromUrl(value: string) {
  try {
    const clean = decodeURIComponent(value.split(/[?#]/, 1)[0]);
    return clean.slice(clean.lastIndexOf("/") + 1);
  } catch {
    return value.split(/[?#]/, 1)[0].split("/").pop() || "";
  }
}

/**
 * The photographic renderer is allowed to claim 1:1 only for a real reference
 * product whose actual base photograph maps to the Exact Live library and only
 * while the customer configuration still equals the reference state captured
 * when that product was selected. Product/database IDs are intentionally not
 * treated as canonical reference IDs because the store API owns those IDs.
 * Any subsequent customization immediately returns control to realtime.
 */
export default function BagBuilderPhotoTrueExactOnly() {
  useEffect(() => {
    let frame = 0;
    let productId = "";
    let baseline: Config | null = null;
    let disabledForProduct = "";

    const sync = () => {
      frame = 0;
      const stage = document.querySelector<HTMLElement>(
        ".abags-vc-dialog.abags-reference-layout-v4 .abags-bag-builder-stage",
      );
      if (!stage) return;

      const selectedProduct = stage.dataset.photoProductId || "";
      const baseImage = stage.querySelector<HTMLImageElement>(".abags-photo-true-base")?.getAttribute("src") || "";
      const reference = EXACT_ATELIER_LIBRARY.find(
        (item) => fileNameFromUrl(baseImage) === item.sourceFile,
      );
      const isKnownReference = Boolean(selectedProduct && reference);
      if (!selectedProduct || !reference || !isKnownReference) {
        stage.removeAttribute("data-abags-photo-true");
        stage.removeAttribute("data-abags-photo-true-reference");
        stage.removeAttribute("data-abags-photo-true-reference-id");
        stage.dataset.abagsPhotoTrueState = "custom-realtime";
        return;
      }

      if (selectedProduct !== productId) {
        productId = selectedProduct;
        baseline = null;
        disabledForProduct = "";
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const currentStage = document.querySelector<HTMLElement>(
            ".abags-vc-dialog.abags-reference-layout-v4 .abags-bag-builder-stage",
          );
          if (!currentStage || currentStage.dataset.photoProductId !== productId) return;
          const currentBaseImage = currentStage.querySelector<HTMLImageElement>(".abags-photo-true-base")?.getAttribute("src") || "";
          const currentReference = EXACT_ATELIER_LIBRARY.find(
            (item) => fileNameFromUrl(currentBaseImage) === item.sourceFile,
          );
          if (!currentReference) {
            currentStage.removeAttribute("data-abags-photo-true");
            currentStage.dataset.abagsPhotoTrueState = "custom-realtime";
            return;
          }
          baseline = readConfig(currentStage);
          currentStage.setAttribute("data-abags-photo-true-reference", "exact-live-v4");
          currentStage.setAttribute("data-abags-photo-true-reference-id", currentReference.id);
          currentStage.dataset.abagsPhotoTrueState = "exact";
          requestSync();
        }));
        return;
      }

      if (!baseline) return;
      const current = readConfig(stage);
      const exact = sameConfig(current, baseline);
      if (!exact) {
        disabledForProduct = productId;
        stage.removeAttribute("data-abags-photo-true");
        stage.dataset.abagsPhotoTrueState = "custom-realtime";
        stage.setAttribute("data-abags-photo-true-reference-id", reference.id);
        stage.querySelector<HTMLElement>(".abags-photo-true-stage")?.style.setProperty("display", "none", "important");
        return;
      }

      if (disabledForProduct === productId) {
        stage.dataset.abagsPhotoTrueState = "custom-realtime";
        return;
      }

      stage.dataset.abagsPhotoTrueState = "exact";
      stage.setAttribute("data-abags-photo-true-reference", "exact-live-v4");
      stage.setAttribute("data-abags-photo-true-reference-id", reference.id);
      stage.setAttribute("data-abags-photo-true", "active");
      const photoStage = stage.querySelector<HTMLElement>(".abags-photo-true-stage");
      photoStage?.style.removeProperty("display");
    };

    const requestSync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(sync);
    };

    const observer = new MutationObserver(requestSync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "data-photo-product-id",
        "data-family",
        "data-color",
        "data-stitch",
        "data-flap",
        "data-handles",
        "data-strap",
        "data-hardware",
        "data-accent",
        "data-abags-photo-true",
      ],
    });

    requestSync();
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
