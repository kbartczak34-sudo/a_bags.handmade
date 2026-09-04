"use client";

import { useEffect } from "react";

const BASE_ONLY = new Set([
  "flap:none",
  "handles:none",
  "strap:none",
  "accent:none",
]);

function optionName(button: HTMLButtonElement) {
  return button.querySelector<HTMLElement>(".abags-builder-option-copy strong")?.textContent?.trim()
    || button.textContent?.trim()
    || "Wariant";
}

function annotate(button: HTMLButtonElement) {
  const key = button.dataset.builderKey || "";
  const value = button.dataset.builderValue || "";
  if (!key || key === "family" || !button.hasAttribute("data-photo-exact")) return;

  const isBase = BASE_ONLY.has(`${key}:${value}`);
  const isExact = button.dataset.photoExact === "true";
  const status = isBase ? "base" : isExact ? "exact" : "written";
  const description = status === "base"
    ? "Podgląd korzysta bezpośrednio z prawdziwego zdjęcia bazowego; dodatkowa warstwa 1:1 nie jest potrzebna."
    : status === "exact"
      ? "Ten wariant ma przygotowaną prawdziwą warstwę fotograficzną 1:1 dla wybranego modelu."
      : "Wariant zostanie zapisany w projekcie, ale nie ma jeszcze fotograficznej warstwy 1:1. Zdjęcie nie będzie sztucznie domalowywane.";

  button.dataset.photoPreviewStatus = status;
  button.dataset.photoPreviewLabel = status === "base" ? "BAZA" : status === "exact" ? "1:1" : "BEZ 1:1";
  button.setAttribute("aria-label", `${optionName(button)}. ${description}`);
  button.title = description;
}

function clearAnnotation(button: HTMLButtonElement) {
  delete button.dataset.photoPreviewStatus;
  delete button.dataset.photoPreviewLabel;
  button.removeAttribute("aria-label");
}

function syncTruthStates() {
  const dialog = document.querySelector<HTMLElement>('.abags-vc-dialog.abags-reference-layout-v4[data-abags-photo-true="active"]');
  if (!dialog) return;
  dialog.querySelectorAll<HTMLButtonElement>('button[data-builder-key][data-photo-exact]').forEach(annotate);
}

export default function BagBuilderPhotoTrueOptionTruth() {
  useEffect(() => {
    let frame = 0;
    const requestSync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        syncTruthStates();
      });
    };

    requestSync();
    const observer = new MutationObserver(requestSync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-photo-exact", "data-photo-product-id", "data-abags-photo-true"],
    });

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      document.querySelectorAll<HTMLButtonElement>('button[data-photo-preview-status]').forEach(clearAnnotation);
    };
  }, []);

  return null;
}
