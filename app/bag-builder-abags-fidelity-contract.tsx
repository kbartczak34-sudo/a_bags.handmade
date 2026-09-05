"use client";

import { useEffect } from "react";

type Copy = { label: string; description: string; reference: string };

const FAMILY_COPY: Record<string, Copy> = {
  tote: {
    label: "Kuferek / tote",
    description: "Fason odtwarzany wyłącznie z rzeczywistych torebek Agaty: szeroki, uporządkowany korpus i charakterystyczna linia uchwytów.",
    reference: "pastel-tote-wood-bow",
  },
  round: {
    label: "Okrągła",
    description: "Okrągły fason Agaty z zachowaniem proporcji korpusu i promienistego prowadzenia ściegu szydełkowego.",
    reference: "cream-round-taupe-flap",
  },
  bucket: {
    label: "Z klapą",
    description: "Fason Agaty z klapą: zwarty korpus, właściwe osadzenie klapy, paska i okuć bez zmiany charakteru oryginału.",
    reference: "cream-burgundy-flap",
  },
  mini: {
    label: "Strukturalna / mini",
    description: "Kompaktowy fason Agaty z uporządkowanym, prostokątnym korpusem i zachowanymi proporcjami detali.",
    reference: "small-multicolor-chain",
  },
};

const STITCH_COPY: Record<string, Copy> = {
  classic: {
    label: "Ażurowy V",
    description: "Ścieg szydełkowy z rzeczywistych modeli Agaty: otwarty rytm V, bez generowania obcego wzoru.",
    reference: "open-v",
  },
  herringbone: {
    label: "Pionowy ażurowy",
    description: "Pionowy ścieg szydełkowy Agaty z wydłużonymi prześwitami i rytmem kolumnowym.",
    reference: "vertical-open",
  },
  basket: {
    label: "Koszykowy",
    description: "Gęstszy ścieg szydełkowy występujący w torebkach Agaty, z zachowanym rytmem oczek.",
    reference: "basket",
  },
  shell: {
    label: "Promienisty",
    description: "Promienisty ścieg szydełkowy modeli Agaty, prowadzony od środka zgodnie z konstrukcją okrągłych torebek.",
    reference: "radial",
  },
};

const MATERIAL = "Sznurek poliestrowy";
const FIDELITY_VERSION = "agata-products-1to1-v2";

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
    button.dataset.abagsReferenceOwner = "Agata";
    button.setAttribute("aria-label", `${copy.label}. ${copy.description}`);
    button.title = copy.description;
  });
}

function syncStageTruth(stage: HTMLElement) {
  const family = stage.dataset.family || "";
  const stitch = stage.dataset.stitch || "";
  const familyCopy = FAMILY_COPY[family];
  const stitchCopy = STITCH_COPY[stitch];

  stage.dataset.abagsProductOwner = "Agata";
  stage.dataset.abagsMaterial = MATERIAL;
  stage.dataset.abagsFidelityVersion = FIDELITY_VERSION;

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
  stage.classList.toggle("abags-pro3d-active", ready);
  stage.classList.toggle("abags-fidelity3d-active", ready);
  stage.dataset.abagsRendererVisible = ready ? "fidelity3d" : "svg-fallback";
}

function sync(dialog: HTMLElement) {
  const stage = dialog.querySelector<HTMLElement>(".abags-bag-builder-stage");
  if (!stage) return;
  dialog.dataset.abagsFidelityContract = FIDELITY_VERSION;
  dialog.dataset.abagsProductScope = "agata-only";
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
      attributeFilter: ["data-family", "data-stitch", "data-abags-final3d", "data-abags-fidelity3d-ready", "data-abags-fidelity3d-error"],
    });

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      document.querySelectorAll<HTMLElement>(".abags-vc-dialog[data-abags-fidelity-contract]").forEach((dialog) => {
        delete dialog.dataset.abagsFidelityContract;
        delete dialog.dataset.abagsProductScope;
        const stage = dialog.querySelector<HTMLElement>(".abags-bag-builder-stage");
        if (!stage) return;
        delete stage.dataset.abagsRealFamily;
        delete stage.dataset.abagsRealFamilyReference;
        delete stage.dataset.abagsRealStitch;
        delete stage.dataset.abagsRealStitchReference;
        delete stage.dataset.abagsRendererVisible;
        delete stage.dataset.abagsProductOwner;
        delete stage.dataset.abagsMaterial;
        delete stage.dataset.abagsFidelityVersion;
      });
    };
  }, []);

  return null;
}
