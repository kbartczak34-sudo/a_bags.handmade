"use client";

import { useEffect, useState } from "react";
import { ABAGS_REFERENCE_MODELS, getAbagsReferenceModel } from "../lib/abags-reference-models";
import { getAbagsYarnPalette } from "../lib/abags-yarn-palettes";
import { ABAGS_FIDELITY_V4_FAMILY_SPECS } from "../lib/abags-fidelity-v4-family-spec";
import { ABAGS_COGNAC_PRESET, ABAGS_COGNAC_REFERENCE_ID, ABAGS_COGNAC_REFERENCE_IMAGE } from "../lib/abags-cognac-model";
import { EXACT_ATELIER_LIBRARY, EXACT_ATELIER_SPRITE_PARTS } from "../lib/exact-customizer-library";

type Preset = {
  id: string;
  label: string;
  referenceId: string;
  family: string;
  color: string;
  stitch: string;
  flap: string;
  handles: string;
  strap: string;
  hardware: string;
  accent: string;
};

const STEPS = [
  { label: "Fason", key: "family" },
  { label: "Kolor korpusu", key: "color" },
  { label: "Ścieg szydełkowy", key: "stitch" },
  { label: "Klapa / zapięcie", key: "flap" },
  { label: "Uchwyt / pasek", key: "handles" },
  { label: "Dodatki", key: "accent" },
  { label: "Podsumowanie", key: "summary" },
] as const;

const LABELS: Record<string, Record<string, string>> = {
  family: { tote: "Kuferek / tote", round: "Okrągła", bucket: "Z klapą", mini: "Strukturalna / mini", satchel: "Kuferek koniakowy", "tall-tote": "Wysoki kuferek", shoulder: "Listonoszka" },
  stitch: { classic: "Ażurowy V", herringbone: "Pionowy ażurowy", basket: "Koszykowy", shell: "Promienisty" },
  flap: { none: "Bez klapy", crochet: "Szydełkowa", "leather-black": "Skóra czarna", "leather-cognac": "Skóra koniak", "suede-burgundy": "Zamsz bordo" },
  handles: { none: "Bez uchwytu", "wood-light": "Drewno jasne", "wood-dark": "Drewno ciemne", crochet: "Uchwyt szydełkowy", "leather-braid": "Pleciona rączka skórzana" },
  strap: { none: "Bez paska", leather: "Pasek skórzany", woven: "Pasek tkany", chain: "Łańcuszek", "woven-ornament": "Pasek ornamentowy", "crochet-braid": "Szydełkowy pasek", "woven-floral": "Pasek kwiatowy", "woven-striped": "Pasek w pasy", "chain-leather": "Łańcuszek ze skórą" },
  hardware: { gold: "Złote", silver: "Srebrne", black: "Czarne" },
  accent: { none: "Bez ozdoby", tassel: "Chwost", scarf: "Apaszka", bow: "Kokarda", charm: "Zawieszka" },
};

const COLOR_LABELS: Record<string, string> = {
  "#E8DDCC": "Naturalny beż",
  "#E4A9B5": "Pudrowy róż",
  "#24324D": "Głęboki granat",
  "#65493D": "Czekoladowy brąz",
  "#C7962F": "Musztardowy",
  "#222124": "Czarny",
  "#B93A42": "Czerwony",
  "#275C4A": "Butelkowa zieleń",
  "#087E81": "Turkus",
  "#A88AE0": "Lawendowy",
  "#C7652F": "Miedziany ombré",
  "#88583F": "Brąz ombré",
  "#D58FAA": "Róż ombré",
  "#BA9ECF": "Pastel wielokolorowy",
  "#0E9AA7": "Zieleń · turkus · niebieski",
};

const PRESETS: Preset[] = [
  ...ABAGS_REFERENCE_MODELS.map(model => ({ id: model.id, label: model.label, referenceId: model.id, ...model.config })),
  { id: "cognac-ombre", label: "Kuferek koniakowy", referenceId: ABAGS_COGNAC_REFERENCE_ID, ...ABAGS_COGNAC_PRESET },
  { id: "navy", label: "Granat", referenceId: "navy-wood-scarf-chain", family: "tote", color: "#24324D", stitch: "classic", flap: "none", handles: "wood-light", strap: "chain", hardware: "gold", accent: "scarf" },
  { id: "red", label: "Czerwień", referenceId: "red-wood-scarf", family: "tote", color: "#B93A42", stitch: "classic", flap: "none", handles: "wood-dark", strap: "woven", hardware: "gold", accent: "scarf" },
  { id: "black", label: "Czerń", referenceId: "black-leather-flap", family: "bucket", color: "#222124", stitch: "classic", flap: "leather-black", handles: "none", strap: "leather", hardware: "gold", accent: "tassel" },
  { id: "teal", label: "Turkus", referenceId: "teal-wood-chain-stones", family: "mini", color: "#087E81", stitch: "herringbone", flap: "none", handles: "wood-light", strap: "chain", hardware: "gold", accent: "charm" },
  // Additional real photographed A-Bags inspirations. Where the photograph
  // includes unsupported bespoke details, the rendered variant stays editable
  // within the atelier's validated component options.
  { id: "brown-ombre", label: "Brąz ombré", referenceId: "brown-ombre-wood-scarf", family: "tote", color: "#88583F", stitch: "classic", flap: "none", handles: "wood-light", strap: "none", hardware: "gold", accent: "scarf" },
  { id: "pink-ombre", label: "Róż ombré", referenceId: "pink-ombre-dark-wood", family: "tote", color: "#D58FAA", stitch: "classic", flap: "none", handles: "wood-dark", strap: "woven", hardware: "gold", accent: "scarf" },
  { id: "pastel-tote", label: "Pastelowy kuferek", referenceId: "pastel-tote-wood-bow", family: "tote", color: "#BA9ECF", stitch: "classic", flap: "none", handles: "wood-light", strap: "none", hardware: "gold", accent: "bow" },
  { id: "mustard-round", label: "Musztardowa okrągła", referenceId: "mustard-round-navy-flap", family: "round", color: "#C7962F", stitch: "shell", flap: "crochet", handles: "none", strap: "woven", hardware: "gold", accent: "tassel" },
  { id: "cream-burgundy", label: "Kremowa z klapą", referenceId: "cream-burgundy-flap", family: "bucket", color: "#E8DDCC", stitch: "classic", flap: "suede-burgundy", handles: "none", strap: "leather", hardware: "gold", accent: "none" },
  { id: "pastel-mini", label: "Pastelowa mini", referenceId: "small-multicolor-chain", family: "mini", color: "#BA9ECF", stitch: "basket", flap: "crochet", handles: "none", strap: "chain", hardware: "gold", accent: "tassel" },
];

const FAMILY_REFERENCE: Record<string, string> = Object.fromEntries(
  Object.entries(ABAGS_FIDELITY_V4_FAMILY_SPECS).map(([family, spec]) => [family, spec.reference]),
);

function scrollToKey(key: string) {
  const target = key === "summary"
    ? document.querySelector<HTMLElement>(".abags-builder-summary")
    : document.querySelector<HTMLElement>(`button[data-builder-key="${key}"]`)?.closest<HTMLElement>("fieldset") ?? null;
  target?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function valueLabel(key: string, value: string) {
  if (!value) return "—";
  if (key === "color") return COLOR_LABELS[value.toUpperCase()] ?? COLOR_LABELS[value] ?? "Wybrany kolor";
  return LABELS[key]?.[value] ?? value;
}

function selectedStep(stage: HTMLElement) {
  const explicit = Number(stage.dataset.abagsRefStep || "0");
  if (explicit >= 1 && explicit <= STEPS.length) return explicit;
  if (!stage.dataset.family) return 1;
  if (!stage.dataset.color) return 2;
  if (!stage.dataset.stitch) return 3;
  return 4;
}

function stepForKey(key: string) {
  const index = STEPS.findIndex((item) => item.key === key || (item.key === "handles" && key === "strap") || (item.key === "accent" && key === "hardware"));
  return Math.max(1, index + 1);
}

function syncRail(stage: HTMLElement, rail: HTMLElement) {
  const current = selectedStep(stage);
  rail.querySelectorAll<HTMLButtonElement>("button[data-ref-step]").forEach((button) => {
    const step = Number(button.dataset.refStep || "0");
    button.classList.toggle("is-active", step === current);
    if (step === current) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });
}

function syncGroups(dialog: HTMLElement, stage: HTMLElement) {
  const current = selectedStep(stage);
  dialog.querySelectorAll<HTMLElement>(".abags-builder-group").forEach((group) => {
    const key = group.querySelector<HTMLButtonElement>("button[data-builder-key]")?.dataset.builderKey;
    if (!key) return;
    const step = stepForKey(key);
    group.dataset.refCollapsible = "true";
    if (!group.dataset.refTouched) group.classList.toggle("is-ref-expanded", step === current || step === 1);
    const legend = group.querySelector<HTMLElement>("legend");
    if (legend) {
      legend.dataset.refGroupLegend = "true";
      legend.setAttribute("role", "button");
      legend.setAttribute("tabindex", "0");
      legend.setAttribute("aria-expanded", String(group.classList.contains("is-ref-expanded")));
    }
  });
  const progress = dialog.querySelector<HTMLElement>(".abags-builder-heading > span");
  if (progress) progress.textContent = `${current}/7`;
}

function syncLayers(stage: HTMLElement, panel: HTMLElement) {
  const rows = [
    ["family", "Fason", stage.dataset.family || ""],
    ["color", "Kolor korpusu", stage.dataset.color || ""],
    ["stitch", "Ścieg szydełkowy", stage.dataset.stitch || ""],
    ["flap", "Klapa", stage.dataset.flap || "none"],
    ["handles", "Uchwyt", stage.dataset.handles || "none"],
    ["strap", "Pasek", stage.dataset.strap || "none"],
    ["hardware", "Okucia", stage.dataset.hardware || "gold"],
    ["accent", "Detal", stage.dataset.accent || "none"],
  ];

  const list = panel.querySelector<HTMLElement>("[data-ref-layer-list]");
  if (!list) return;
  list.innerHTML = "";
  rows.forEach(([key, title, value]) => {
    if (!value || (value === "none" && (key === "flap" || key === "handles" || key === "strap" || key === "accent"))) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "abags-ref-layer-row";
    button.dataset.refEditKey = key;
    button.innerHTML = `<span class="abags-ref-layer-dot"${key === "color" ? ` style="background:${getAbagsYarnPalette(value)?.swatch ?? value}"` : ""}></span><span><strong>${title}</strong><small>${valueLabel(key, value)}</small></span><span class="abags-ref-layer-edit">Edytuj</span>`;
    list.appendChild(button);
  });
  panel.classList.toggle("is-empty", list.childElementCount === 0);
}

function applyPreset(preset: Preset) {
  // A single verified construction replaces the previous model atomically,
  // so there are no 55ms gaps, missing controls or old-family accessories.
  window.dispatchEvent(new CustomEvent("abags:apply-reference-preset", { detail: preset }));
}

function spritePosition(index: number) {
  const column = index % 5;
  const row = Math.floor(index / 5);
  return `${column * 25}% ${row * (100 / 3)}%`;
}

function applySpriteCell(element: HTMLElement, spriteUrl: string, referenceId: string) {
  const model = ABAGS_REFERENCE_MODELS.find(model => model.id === referenceId);
  const reference = EXACT_ATELIER_LIBRARY.find(item => item.id === (model?.referenceId ?? referenceId));
  const modelPreview = model && !model.referenceId ? model.image : null;
  if ((!reference || !spriteUrl) && !modelPreview) return;
  const direct = Boolean(modelPreview) || reference?.id === ABAGS_COGNAC_REFERENCE_ID;
  const url = modelPreview ?? (reference?.id === ABAGS_COGNAC_REFERENCE_ID ? ABAGS_COGNAC_REFERENCE_IMAGE : spriteUrl);
  element.style.backgroundImage = `url(${JSON.stringify(url)})`;
  element.style.backgroundSize = direct ? "cover" : "500% 400%";
  element.style.backgroundPosition = direct ? "center" : spritePosition(reference!.index);
  element.dataset.referenceId = referenceId;
  element.dataset.referenceKind = modelPreview ? "model-3d" : "photograph";
  element.title = modelPreview ? `Podgląd modelu 3D na podstawie zdjęcia: ${model!.label}` : `Rzeczywisty wzorzec A-Bags: ${model?.label ?? reference!.label}`;
}

function decorateFamilyButtons(dialog: HTMLElement, spriteUrl: string) {
  if (!spriteUrl) return;
  dialog.querySelectorAll<HTMLButtonElement>('button[data-builder-key="family"]').forEach((button) => {
    const value = button.dataset.builderValue || "";
    const model = ABAGS_REFERENCE_MODELS.find(model => model.id === button.dataset.abagsPhotoModel);
    const referenceId = model?.id ?? FAMILY_REFERENCE[value];
    if (!referenceId) return;
    let thumb = button.querySelector<HTMLElement>(".abags-ref-family-photo");
    if (!thumb) {
      thumb = document.createElement("span");
      thumb.className = "abags-ref-family-photo";
      thumb.setAttribute("aria-hidden", "true");
      button.prepend(thumb);
    }
    applySpriteCell(thumb, spriteUrl, referenceId);
    // The customer used to see only the CSS-drawn cartoon thumbnail, even
    // though we already have Agata's real atelier photographs in this sprite.
    const photoThumb = button.querySelector<HTMLElement>(".abags-builder-family-thumb");
    if (photoThumb) {
      if (model) {
        applySpriteCell(photoThumb, spriteUrl, model.id);
        photoThumb.style.setProperty("background-image", photoThumb.style.backgroundImage, "important");
        photoThumb.style.setProperty("background-size", photoThumb.style.backgroundSize, "important");
        photoThumb.style.setProperty("background-position", photoThumb.style.backgroundPosition, "important");
        return;
      }
      const realReference = EXACT_ATELIER_LIBRARY.find((item) => item.id === referenceId);
      if (!realReference) return;
      applySpriteCell(photoThumb, spriteUrl, referenceId);
      // Older important backgrounds on the illustrated thumb must not repaint
      // over the actual photo. Keep the same true sprite cell.
      photoThumb.style.setProperty("background-image", `url(${JSON.stringify(referenceId === ABAGS_COGNAC_REFERENCE_ID ? ABAGS_COGNAC_REFERENCE_IMAGE : spriteUrl)})`, "important");
      photoThumb.style.setProperty("background-size", referenceId === ABAGS_COGNAC_REFERENCE_ID ? "cover" : "500% 400%", "important");
      photoThumb.style.setProperty("background-position", referenceId === ABAGS_COGNAC_REFERENCE_ID ? "center" : spritePosition(realReference.index), "important");
    }
  });
}

/**
 * This is an explicitly labelled PHOTOGRAPHIC REFERENCE, not a picture of the
 * customer's current combination. The interactive Fidelity3D model is never
 * destroyed or replaced, and every configuration change restores its preview.
 */
function ensureAtelierExample(preview: HTMLElement, stage: HTMLElement, spriteUrl: string) {
  const family = stage.dataset.family || "";
  const model = getAbagsReferenceModel({family,color:stage.dataset.color||""});
  const referenceId = model ? model.referenceId : FAMILY_REFERENCE[family];
  const realReference = EXACT_ATELIER_LIBRARY.find((item) => item.id === referenceId);
  let viewer = preview.querySelector<HTMLElement>(':scope > [data-abags-example-ui]');
  if (!spriteUrl || !realReference) {
    if (viewer) viewer.hidden = true;
    return;
  }
  if (!viewer) {
    viewer = document.createElement("div");
    viewer.className = "abags-real-example-ui";
    viewer.dataset.abagsExampleUi = "true";
    viewer.dataset.open = "false";
    viewer.innerHTML = `
      <div class="abags-real-example-image" role="img"></div>
      <div class="abags-real-example-note">
        <strong>Rzeczywista torebka Agaty</strong>
        <span>Zdjęcie przykładowego fasonu, nie wizualizacja wybranych zmian.</span>
      </div>
      <button type="button" class="abags-real-example-toggle" data-abags-example-toggle aria-pressed="false">Pokaż prawdziwą torebkę</button>
    `;
    preview.appendChild(viewer);
  }
  viewer.hidden = false;
  const signature = ["family", "color", "stitch", "flap", "handles", "strap", "hardware", "accent"]
    .map((key) => stage.getAttribute(`data-${key}`) || "").join("|");
  if (viewer.dataset.exampleSignature !== signature) {
    viewer.dataset.exampleSignature = signature;
    viewer.dataset.open = "false";
  }
  const image = viewer.querySelector<HTMLElement>(".abags-real-example-image");
  if (image) {
    applySpriteCell(image, spriteUrl, realReference.id);
    image.setAttribute("aria-label", `Zdjęcie przykładowej torebki A-Bags: ${realReference.label}; nie jest to podgląd Twoich zmian`);
  }
  const toggle = viewer.querySelector<HTMLButtonElement>("[data-abags-example-toggle]");
  if (toggle) {
    const open = viewer.dataset.open === "true";
    toggle.setAttribute("aria-pressed", String(open));
    const text = open ? "Wróć do modelu 3D" : "Pokaż prawdziwą torebkę";
    if (toggle.textContent !== text) toggle.textContent = text;
  }
}

function makeRail() {
  const rail = document.createElement("nav");
  rail.className = "abags-ref-step-rail";
  rail.setAttribute("aria-label", "Etapy projektowania torebki");
  STEPS.forEach((step, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.refStep = String(index + 1);
    button.dataset.refKey = step.key;
    button.innerHTML = `<span>${index + 1}</span><strong>${step.label}</strong>`;
    rail.appendChild(button);
  });
  return rail;
}

function makeLayers() {
  const panel = document.createElement("aside");
  panel.className = "abags-ref-layers";
  panel.innerHTML = `<div class="abags-ref-layers-head"><strong>Aktywne warstwy</strong><small>Kliknij warstwę, aby edytować</small></div><div data-ref-layer-list></div>`;
  return panel;
}

function makeInspirations(spriteUrl: string) {
  const section = document.createElement("section");
  section.className = "abags-ref-inspirations";
  section.setAttribute("aria-label", "Inspiracje A-Bags");
  section.innerHTML = `<div class="abags-ref-inspiration-head"><strong>Inspiracje dla Ciebie</strong><small>Rzeczywiste wzorce A-Bags · kliknij, aby rozpocząć i dalej edytować</small></div><div class="abags-ref-inspiration-track"></div>`;
  const track = section.querySelector<HTMLElement>(".abags-ref-inspiration-track");
  PRESETS.forEach((preset) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.refPreset = preset.id;
    button.setAttribute("aria-label", `Wybierz wzorzec ${preset.label} i edytuj model 3D`);
    const photo = document.createElement("span");
    photo.className = "abags-ref-photo";
    photo.setAttribute("aria-hidden", "true");
    if (spriteUrl) applySpriteCell(photo, spriteUrl, preset.referenceId);
    else {
      photo.classList.add("is-loading");
      photo.style.setProperty("--ref-bag", preset.color);
    }
    const copy = document.createElement("span");
    copy.className = "abags-ref-inspiration-copy";
    copy.innerHTML = `<strong>${preset.label}</strong><small>Inspiracja · edytowalna 3D</small>`;
    button.append(photo, copy);
    track?.appendChild(button);
  });
  return section;
}

// The dialog often mounts before the segmented reference atlas finishes
// loading. Hydrate existing cards in place when the asset arrives instead of
// leaving fallback gradients stuck for the rest of the customer session.
function hydrateInspirations(section: HTMLElement, spriteUrl: string) {
  if (!spriteUrl) return;
  for (const preset of PRESETS) {
    const photo = [...section.querySelectorAll<HTMLElement>(".abags-ref-photo")]
      .find((node) => node.parentElement?.getAttribute("data-ref-preset") === preset.id);
    if (!photo || photo.dataset.referenceId === preset.referenceId) continue;
    applySpriteCell(photo, spriteUrl, preset.referenceId);
    if (photo.dataset.referenceId === preset.referenceId) {
      photo.classList.remove("is-loading");
      photo.style.removeProperty("--ref-bag");
    }
  }
}

function makeTrust() {
  const bar = document.createElement("div");
  bar.className = "abags-ref-trust";
  bar.innerHTML = `<span>♡ Ręcznie wykonywane</span><span>◇ Projekt na zamówienie</span><span>✦ Materiały premium</span><span>✓ Termin potwierdzany przez pracownię</span>`;
  return bar;
}

export default function BagBuilderReferenceExperience() {
  const [spriteUrl, setSpriteUrl] = useState("");

  useEffect(() => {
    let disposed = false;
    let objectUrl = "";
    Promise.all(EXACT_ATELIER_SPRITE_PARTS.map(async (path) => {
      const response = await fetch(path, { cache: "force-cache" });
      if (!response.ok) throw new Error(`Nie udało się wczytać biblioteki atelier: ${path}`);
      return (await response.text()).trim();
    })).then((parts) => {
      if (disposed) return;
      const encoded = parts.join("");
      const binary = window.atob(encoded);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      objectUrl = URL.createObjectURL(new Blob([bytes], { type: "image/webp" }));
      setSpriteUrl(objectUrl);
    }).catch(() => {
      if (!disposed) setSpriteUrl("");
    });
    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    let cleanupClick: (() => void) | null = null;
    let cleanupKey: (() => void) | null = null;

    const sync = () => {
      frame = 0;
      const dialog = document.querySelector<HTMLElement>(".abags-vc-dialog.abags-vc-builder-active");
      const stage = dialog?.querySelector<HTMLElement>('.abags-vc-preview .abags-bag-builder-stage[data-abags-live-stage="true"]')
        ?? dialog?.querySelector<HTMLElement>(".abags-vc-preview .abags-bag-builder-stage")
        ?? dialog?.querySelector<HTMLElement>(".abags-bag-builder-stage")
        ?? null;
      const mount = dialog?.querySelector<HTMLElement>(".abags-exact-live-mount") ?? null;
      const preview = dialog?.querySelector<HTMLElement>(".abags-vc-preview") ?? null;
      const previewColumn = dialog?.querySelector<HTMLElement>(".abags-vc-preview-column") ?? null;
      const layout = dialog?.querySelector<HTMLElement>(".abags-vc-layout") ?? null;
      if (!dialog || !stage || !mount || !preview || !previewColumn || !layout) return;

      dialog.classList.add("abags-reference-experience-active");

      let rail = mount.querySelector<HTMLElement>(":scope > .abags-ref-step-rail");
      if (!rail) {
        rail = makeRail();
        mount.prepend(rail);
      }

      let layers = preview.querySelector<HTMLElement>(":scope > .abags-ref-layers");
      if (!layers) {
        layers = makeLayers();
        preview.appendChild(layers);
      }

      let inspirations = previewColumn.querySelector<HTMLElement>(":scope > .abags-ref-inspirations");
      if (!inspirations) {
        inspirations = makeInspirations(spriteUrl);
        previewColumn.appendChild(inspirations);
      }
      hydrateInspirations(inspirations, spriteUrl);

      let trust = dialog.querySelector<HTMLElement>(":scope > .abags-ref-trust");
      if (!trust) {
        trust = makeTrust();
        dialog.appendChild(trust);
      }

      syncRail(stage, rail);
      syncGroups(dialog, stage);
      syncLayers(stage, layers);
      decorateFamilyButtons(dialog, spriteUrl);
      ensureAtelierExample(preview, stage, spriteUrl);

      const chip = stage.querySelector<HTMLElement>(".abags-canvas3d-chip, .abags-pro3d-chip");
      if (chip) chip.textContent = "PODGLĄD NA ŻYWO · OBRÓT 360°";

      if (!cleanupClick) {
        const onClick = (event: MouseEvent) => {
          const target = event.target as HTMLElement | null;
          const exampleToggle = target?.closest<HTMLButtonElement>("[data-abags-example-toggle]");
          if (exampleToggle) {
            const viewer = exampleToggle.closest<HTMLElement>("[data-abags-example-ui]");
            if (!viewer) return;
            viewer.dataset.open = viewer.dataset.open === "true" ? "false" : "true";
            const open = viewer.dataset.open === "true";
            exampleToggle.setAttribute("aria-pressed", String(open));
            exampleToggle.textContent = open ? "Wróć do modelu 3D" : "Pokaż prawdziwą torebkę";
            return;
          }
          const stepButton = target?.closest<HTMLButtonElement>("button[data-ref-step]");
          if (stepButton) {
            const key = stepButton.dataset.refKey || "family";
            const currentStage = document.querySelector<HTMLElement>(".abags-bag-builder-stage");
            if (currentStage) currentStage.dataset.abagsRefStep = stepButton.dataset.refStep || "1";
            scrollToKey(key);
            requestSync();
            return;
          }

          const legend = target?.closest<HTMLElement>("legend[data-ref-group-legend]");
          if (legend) {
            const group = legend.closest<HTMLElement>(".abags-builder-group");
            if (group) {
              group.dataset.refTouched = "true";
              group.classList.toggle("is-ref-expanded");
              legend.setAttribute("aria-expanded", String(group.classList.contains("is-ref-expanded")));
            }
            return;
          }

          const layerButton = target?.closest<HTMLButtonElement>("button[data-ref-edit-key]");
          if (layerButton) {
            const key = layerButton.dataset.refEditKey || "family";
            scrollToKey(key);
            return;
          }

          const presetButton = target?.closest<HTMLButtonElement>("button[data-ref-preset]");
          if (presetButton) {
            const preset = PRESETS.find((item) => item.id === presetButton.dataset.refPreset);
            if (preset) { applyPreset(preset); requestSync(); }
            return;
          }

          const builderButton = target?.closest<HTMLButtonElement>("button[data-builder-key]");
          if (builderButton) {
            const currentStage = document.querySelector<HTMLElement>(".abags-bag-builder-stage");
            const key = builderButton.dataset.builderKey || "family";
            const step = stepForKey(key);
            if (currentStage) currentStage.dataset.abagsRefStep = String(step);
            const group = builderButton.closest<HTMLElement>(".abags-builder-group");
            if (group) {
              group.dataset.refTouched = "true";
              group.classList.add("is-ref-expanded");
            }
            window.setTimeout(requestSync, 80);
          }
        };
        document.addEventListener("click", onClick, true);
        cleanupClick = () => document.removeEventListener("click", onClick, true);
      }

      if (!cleanupKey) {
        const onKey = (event: KeyboardEvent) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          const target = event.target as HTMLElement | null;
          const legend = target?.closest<HTMLElement>("legend[data-ref-group-legend]");
          if (!legend) return;
          event.preventDefault();
          legend.click();
        };
        document.addEventListener("keydown", onKey, true);
        cleanupKey = () => document.removeEventListener("keydown", onKey, true);
      }
    };

    const requestSync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(sync);
    };

    requestSync();
    const observer = new MutationObserver(requestSync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-family", "data-color", "data-stitch", "data-flap", "data-handles", "data-strap", "data-hardware", "data-accent"] });
    window.addEventListener("resize", requestSync);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", requestSync);
      if (frame) window.cancelAnimationFrame(frame);
      cleanupClick?.();
      cleanupKey?.();
      document.querySelectorAll(".abags-reference-experience-active").forEach((node) => node.classList.remove("abags-reference-experience-active"));
      document.querySelectorAll(".abags-ref-step-rail,.abags-ref-layers,.abags-ref-inspirations,.abags-ref-trust,.abags-ref-family-photo,.abags-real-example-ui").forEach((node) => node.remove());
      document.querySelectorAll<HTMLElement>(".abags-builder-family-thumb[data-reference-id]").forEach((thumb) => {
        thumb.style.removeProperty("background-image");
        thumb.style.removeProperty("background-size");
        thumb.style.removeProperty("background-position");
        delete thumb.dataset.referenceId;
      });
    };
  }, [spriteUrl]);

  return null;
}