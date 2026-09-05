"use client";

import { useEffect, useState } from "react";
import { ABAGS_FIDELITY_V4_FAMILY_SPECS } from "../lib/abags-fidelity-v4-family-spec";
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
  family: { tote: "Kuferek / tote", round: "Okrągła", bucket: "Z klapą", mini: "Strukturalna / mini" },
  stitch: { classic: "Ażurowy V", herringbone: "Pionowy ażurowy", basket: "Koszykowy", shell: "Promienisty" },
  flap: { none: "Bez klapy", crochet: "Szydełkowa", "leather-black": "Skóra czarna", "leather-cognac": "Skóra koniak", "suede-burgundy": "Zamsz bordo" },
  handles: { none: "Bez uchwytu", "wood-light": "Drewno jasne", "wood-dark": "Drewno ciemne", crochet: "Uchwyt szydełkowy" },
  strap: { none: "Bez paska", leather: "Pasek skórzany", woven: "Pasek tkany", chain: "Łańcuszek" },
  hardware: { gold: "Złote", silver: "Srebrne", black: "Czarne" },
  accent: { none: "Bez ozdoby", tassel: "Chwost", scarf: "Apaszka / kokarda", charm: "Zawieszka" },
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
};

const PRESETS: Preset[] = [
  { id: "navy", label: "Granat", referenceId: "navy-wood-scarf-chain", family: "tote", color: "#24324D", stitch: "classic", flap: "none", handles: "wood-light", strap: "chain", hardware: "gold", accent: "scarf" },
  { id: "red", label: "Czerwień", referenceId: "red-wood-scarf", family: "tote", color: "#B93A42", stitch: "classic", flap: "none", handles: "wood-dark", strap: "woven", hardware: "gold", accent: "scarf" },
  { id: "black", label: "Czerń", referenceId: "black-leather-flap", family: "bucket", color: "#222124", stitch: "classic", flap: "leather-black", handles: "none", strap: "leather", hardware: "gold", accent: "tassel" },
  { id: "teal", label: "Turkus", referenceId: "teal-wood-chain-stones", family: "mini", color: "#087E81", stitch: "herringbone", flap: "none", handles: "wood-light", strap: "chain", hardware: "gold", accent: "charm" },
];

const FAMILY_REFERENCE: Record<string, string> = Object.fromEntries(
  Object.entries(ABAGS_FIDELITY_V4_FAMILY_SPECS).map(([family, spec]) => [family, spec.reference]),
);

function getChoice(key: string, value: string) {
  return [...document.querySelectorAll<HTMLButtonElement>(`button[data-builder-key="${key}"]`)]
    .find((button) => button.dataset.builderValue === value) ?? null;
}

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
    button.innerHTML = `<span class="abags-ref-layer-dot"${key === "color" ? ` style="background:${value}"` : ""}></span><span><strong>${title}</strong><small>${valueLabel(key, value)}</small></span><span class="abags-ref-layer-edit">Edytuj</span>`;
    list.appendChild(button);
  });
  panel.classList.toggle("is-empty", list.childElementCount === 0);
}

async function applyPreset(preset: Preset) {
  const sequence: Array<[string, string]> = [
    ["family", preset.family],
    ["color", preset.color],
    ["stitch", preset.stitch],
    ["flap", preset.flap],
    ["handles", preset.handles],
    ["strap", preset.strap],
    ["hardware", preset.hardware],
    ["accent", preset.accent],
  ];
  for (const [key, value] of sequence) {
    await new Promise((resolve) => window.setTimeout(resolve, 55));
    getChoice(key, value)?.click();
  }
}

function spritePosition(index: number) {
  const column = index % 5;
  const row = Math.floor(index / 5);
  return `${column * 25}% ${row * (100 / 3)}%`;
}

function applySpriteCell(element: HTMLElement, spriteUrl: string, referenceId: string) {
  const reference = EXACT_ATELIER_LIBRARY.find((item) => item.id === referenceId);
  if (!reference || !spriteUrl) return;
  element.style.backgroundImage = `url(${JSON.stringify(spriteUrl)})`;
  element.style.backgroundSize = "500% 400%";
  element.style.backgroundPosition = spritePosition(reference.index);
  element.dataset.referenceId = reference.id;
  element.title = `Rzeczywisty wzorzec A-Bags: ${reference.label}`;
}

function decorateFamilyButtons(dialog: HTMLElement, spriteUrl: string) {
  if (!spriteUrl) return;
  dialog.querySelectorAll<HTMLButtonElement>('button[data-builder-key="family"]').forEach((button) => {
    const value = button.dataset.builderValue || "";
    const referenceId = FAMILY_REFERENCE[value];
    if (!referenceId) return;
    let thumb = button.querySelector<HTMLElement>(".abags-ref-family-photo");
    if (!thumb) {
      thumb = document.createElement("span");
      thumb.className = "abags-ref-family-photo";
      thumb.setAttribute("aria-hidden", "true");
      button.prepend(thumb);
    }
    applySpriteCell(thumb, spriteUrl, referenceId);
  });
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
    copy.innerHTML = `<strong>${preset.label}</strong><small>Wzorzec atelier</small>`;
    button.append(photo, copy);
    track?.appendChild(button);
  });
  return section;
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
      const stage = dialog?.querySelector<HTMLElement>(".abags-bag-builder-stage") ?? null;
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

      let trust = dialog.querySelector<HTMLElement>(":scope > .abags-ref-trust");
      if (!trust) {
        trust = makeTrust();
        dialog.appendChild(trust);
      }

      syncRail(stage, rail);
      syncGroups(dialog, stage);
      syncLayers(stage, layers);
      decorateFamilyButtons(dialog, spriteUrl);

      const chip = stage.querySelector<HTMLElement>(".abags-canvas3d-chip, .abags-pro3d-chip");
      if (chip) chip.textContent = "PODGLĄD NA ŻYWO · OBRÓT 360°";

      if (!cleanupClick) {
        const onClick = (event: MouseEvent) => {
          const target = event.target as HTMLElement | null;
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
            if (preset) void applyPreset(preset).then(requestSync);
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
      document.querySelectorAll(".abags-ref-step-rail,.abags-ref-layers,.abags-ref-inspirations,.abags-ref-trust,.abags-ref-family-photo").forEach((node) => node.remove());
    };
  }, [spriteUrl]);

  return null;
}