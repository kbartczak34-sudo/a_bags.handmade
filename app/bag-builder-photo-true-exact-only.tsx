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

/**
 * The photographic renderer is allowed to claim 1:1 only for a real reference
 * product in the Exact Live library and only while the customer configuration
 * still equals the reference state captured when that product was selected.
 * Any subsequent customization immediately returns control to the realtime
 * construction renderer instead of compositing a misleading photograph.
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
      const isKnownReference = EXACT_ATELIER_LIBRARY.some((item) => item.id === selectedProduct);
      if (!selectedProduct || !isKnownReference) {
        stage.removeAttribute("data-abags-photo-true");
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
          baseline = readConfig(currentStage);
          currentStage.dataset.abagsPhotoTrueReference = "exact-live-v4";
          currentStage.dataset.abagsPhotoTrueReferenceId = productId;
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
        stage.dataset.abagsPhotoTrueReferenceId = productId;
        stage.querySelector<HTMLElement>(".abags-photo-true-stage")?.style.setProperty("display", "none", "important");
        return;
      }

      if (disabledForProduct === productId) {
        stage.dataset.abagsPhotoTrueState = "custom-realtime";
        return;
      }

      stage.dataset.abagsPhotoTrueState = "exact";
      stage.dataset.abagsPhotoTrueReference = "exact-live-v4";
      stage.dataset.abagsPhotoTrueReferenceId = productId;
      stage.dataset.abagsPhotoTrue = "active";
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
