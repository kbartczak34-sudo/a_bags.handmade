"use client";

import { useEffect } from "react";

type Copy = { label: string; description: string; reference: string };

const FAMILY_COPY: Record<string, Copy> = {
  tote: {
    label: "Kuferek / tote",
    description: "Klasyczny fason A-Bags z szerokim korpusem i możliwością drewnianych uchwytów.",
    reference: "pastel-tote-wood-bow",
  },
  round: {
    label: "Okrągła",
    description: "Okrągły fason A-Bags z promienistym lub ażurowym splotem.",
    reference: "cream-round-taupe-flap",
  },
  bucket: {
    label: "Z klapą",
    description: "Fason A-Bags z wyraźną klapą i paskiem, kalibrowany do modeli skórzanych i szydełkowych.",
    reference: "cream-burgundy-flap",
  },
  mini: {
    label: "Strukturalna / mini",
    description: "Kompaktowy, uporządkowany korpus A-Bags o bardziej prostokątnej geometrii.",
    reference: "small-multicolor-chain",
  },
};

const STITCH_COPY: Record<string, Copy> = {
  classic: {
    label: "Ażurowy V",
    description: "Charakterystyczny otwarty rytm V widoczny w wielu rzeczywistych modelach A-Bags.",
    reference: "open-v",
  },
  herringbone: {
    label: "Pionowy ażurowy",
    description: "Pionowy, wydłużony splot z wyraźnymi prześwitami i rytmem kolumnowym.",
    reference: "vertical-open",
  },
  basket: {
    label: "Koszykowy",
    description: "Gęstszy, przeplatany splot o uporządkowanej strukturze koszykowej.",
    reference: "basket",
  },
  shell: {
    label: "Promienisty",
    description: "Splot budowany promieniście od środka, charakterystyczny dla okrągłych modeli A-Bags.",
    reference: "radial",
  },
};

function setText(node: Element | null, value: string) {
  if (node && node.textContent !== value) node.textContent = value;
}

function syncButtonCopy(dialog: HTMLElement) {
  dialog.querySelectorAll<HTMLButtonElement>("button[data-builder-key][data-builder-value]").forEach((button) => {
    const key = button.dataset.builderKey || "";
    const value = button.dataset.builderValue || "";
    const copy = key === "family" ? FAMILY_COPY[value] : key === "stitch" ? STITCH_COPY[value] : undefined;
    if (!copy) return;

    const strong = button.querySelector(".abags-builder-option-copy strong");
    const small = button.querySelector(".abags-builder-option-copy small");
    setText(strong, copy.label);
    if (small) setText(small, copy.description);
    button.dataset.abagsRealReference = copy.reference;
    button.setAttribute("aria-label", `${copy.label}. ${copy.description}`);
    button.title = copy.description;
  });
}

function syncStageTruth(stage: HTMLElement) {
  const family = stage.dataset.family || "";
  const stitch = stage.dataset.stitch || "";
  const familyCopy = FAMILY_COPY[family];
  const stitchCopy = STITCH_COPY[stitch];

  if (familyCopy) {
    stage.dataset.abagsRealFamily = familyCopy.label;
    stage.dataset.abagsRealFamilyReference = familyCopy.reference;
  } else {
    delete stage.dataset.abagsRealFamily;
    delete stage.dataset.abagsRealFamilyReference;
  }

  if (stitchCopy) {
    stage.dataset.abagsRealStitch = stitchCopy.label;
    stage.dataset.abagsRealStitchReference = stitchCopy.reference;
  } else {
    delete stage.dataset.abagsRealStitch;
    delete stage.dataset.abagsRealStitchReference;
  }
}

function syncRendererClasses(stage: HTMLElement) {
  const state = stage.dataset.abagsFinal3d || "";
  const ready = state === "ready";

  // `abags-pro3d-active` historically meant two different things: context initialized
  // and renderer accepted for the customer. Legacy V4 CSS hides the SVG whenever the
  // class exists, so it must only represent the second meaning from now on.
  stage.classList.toggle("abags-pro3d-active", ready);
  stage.classList.toggle("abags-fidelity3d-active", ready);
  stage.dataset.abagsRendererVisible = ready ? "fidelity3d" : "svg-fallback";
}

function sync(dialog: HTMLElement) {
  const stage = dialog.querySelector<HTMLElement>(".abags-bag-builder-stage");
  if (!stage) return;
  dialog.dataset.abagsFidelityContract = "real-products-v1";
  syncButtonCopy(dialog);
  syncStageTruth(stage);
  syncRendererClasses(stage);
}

export default function BagBuilderAbagsFidelityContract() {
  useEffect(() => {
    let frame = 0;
    const run = () => {
      frame = 0;
      const dialog = document.querySelector<HTMLElement>(".abags-vc-dialog.abags-vc-builder-active");
      if (dialog) sync(dialog);
    };
    const requestSync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(run);
    };

    requestSync();
    const observer = new MutationObserver(requestSync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "data-family",
        "data-stitch",
        "data-abags-final3d",
        "data-abags-fidelity3d-ready",
        "data-abags-fidelity3d-error",
      ],
    });

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      document.querySelectorAll<HTMLElement>(".abags-vc-dialog[data-abags-fidelity-contract]").forEach((dialog) => {
        delete dialog.dataset.abagsFidelityContract;
        const stage = dialog.querySelector<HTMLElement>(".abags-bag-builder-stage");
        if (!stage) return;
        delete stage.dataset.abagsRealFamily;
        delete stage.dataset.abagsRealFamilyReference;
        delete stage.dataset.abagsRealStitch;
        delete stage.dataset.abagsRealStitchReference;
        delete stage.dataset.abagsRendererVisible;
      });
    };
  }, []);

  return null;
}
