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
 * Any non-reference customization immediately returns control to realtime.
 * Returning to the exact photographed configuration is allowed and re-enables
 * the real reference photograph.
 */
export default function BagBuilderPhotoTrueExactOnly() {
  useEffect(() => {
    let frame = 0;
    let productId = "";
    let baseline: Config | null = null;

    const clearExactState = (stage: HTMLElement) => {
      productId = "";
      baseline = null;
      stage.removeAttribute("data-abags-photo-true");
      stage.removeAttribute("data-abags-photo-true-reference");
      stage.removeAttribute("data-abags-photo-true-reference-id");
      stage.dataset.abagsPhotoTrueState = "custom-realtime";
      stage.querySelector<HTMLElement>(".abags-photo-true-stage")?.style.setProperty("display", "none", "important");
    };

    const sync = () => {
      frame = 0;
      const stage = document.querySelector<HTMLElement>(
        ".abags-vc-dialog.abags-reference-layout-v4 .abags-bag-builder-stage",
      );
      if (!stage) {
        productId = "";
        baseline = null;
        return;
      }

      const selectedProduct = stage.dataset.photoProductId || "";
      const baseImage =
        stage.querySelector<HTMLImageElement>(".abags-photo-true-base")?.getAttribute("src") || "";
      const reference = EXACT_ATELIER_LIBRARY.find(
        (item) => fileNameFromUrl(baseImage).toLowerCase() === item.sourceFile.toLowerCase(),
      );
      const referenceId = reference?.id || "";
      const img = stage.querySelector<HTMLImageElement>(".abags-photo-true-base");
      const validImage = Boolean(img?.complete && img.naturalWidth > 0 && img.naturalHeight > 0);
      // A real product photograph from the catalog is valid as a photograph,
      // but never pretend it is a calibrated 1:1 Exact Live reference.
      let catalogPhoto = false;
      try {
        const url = new URL(baseImage, window.location.origin);
        catalogPhoto = validImage
          && baseImage === stage.dataset.photoProductImageUrl
          && url.origin === window.location.origin
          && url.pathname === "/api/product-image"
          && url.searchParams.get("id") === selectedProduct;
      } catch { /* An invalid/untrusted image must not replace the 3D preview. */ }
      const source = referenceId ? "exact-live-v4" : catalogPhoto ? "catalog-photo" : "";
      const resolvedId = referenceId || (catalogPhoto ? `catalog-photo-${selectedProduct}` : "");
      if (!selectedProduct || !validImage || !resolvedId) {
        clearExactState(stage);
        return;
      }

      if (selectedProduct !== productId) {
        productId = selectedProduct;
        baseline = null;
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const currentStage = document.querySelector<HTMLElement>(
              ".abags-vc-dialog.abags-reference-layout-v4 .abags-bag-builder-stage",
            );
            if (!currentStage || currentStage.dataset.photoProductId !== productId) return;
            const currentBaseImage =
              currentStage.querySelector<HTMLImageElement>(".abags-photo-true-base")?.getAttribute("src") || "";
            const currentReference = EXACT_ATELIER_LIBRARY.find(
              (item) =>
                fileNameFromUrl(currentBaseImage).toLowerCase() === item.sourceFile.toLowerCase(),
            );
            const currentReferenceId = currentReference?.id || "";
            const currentImage = currentStage.querySelector<HTMLImageElement>(".abags-photo-true-base");
            const photoLoaded = Boolean(currentImage?.complete && currentImage.naturalWidth > 0);
            if (!photoLoaded || (source === "exact-live-v4" && !currentReferenceId)) {
              clearExactState(currentStage);
              return;
            }
            baseline = readConfig(currentStage);
            currentStage.setAttribute("data-abags-photo-true-reference", source);
            currentStage.setAttribute("data-abags-photo-true-reference-id", resolvedId);
            currentStage.dataset.abagsPhotoTrueState = source === "exact-live-v4" ? "exact" : "catalog-photograph";
            currentStage.setAttribute("data-abags-photo-true", "active");
            currentStage.querySelector<HTMLElement>(".abags-photo-true-stage")?.style.removeProperty("display");
            requestSync();
          }),
        );
        return;
      }

      if (!baseline) return;
      const current = readConfig(stage);
      const exact = sameConfig(current, baseline);
      if (!exact) {
        stage.removeAttribute("data-abags-photo-true");
        stage.removeAttribute("data-abags-photo-true-reference");
        stage.dataset.abagsPhotoTrueState = "custom-realtime";
        stage.setAttribute("data-abags-photo-true-reference-id", resolvedId);
        stage.querySelector<HTMLElement>(".abags-photo-true-stage")?.style.setProperty("display", "none", "important");
        return;
      }

      stage.dataset.abagsPhotoTrueState = source === "exact-live-v4" ? "exact" : "catalog-photograph";
      stage.setAttribute("data-abags-photo-true-reference", source);
      stage.setAttribute("data-abags-photo-true-reference-id", resolvedId);
      stage.setAttribute("data-abags-photo-true", "active");
      stage.querySelector<HTMLElement>(".abags-photo-true-stage")?.style.removeProperty("display");
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
        "src",
        "data-photo-true-ready",
        "data-photo-product-id",
        "data-family",
        "data-color",
        "data-stitch",
        "data-flap",
        "data-handles",
        "data-strap",
        "data-hardware",
        "data-accent",
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
