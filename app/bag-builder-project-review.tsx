"use client";

import { useEffect } from "react";

type BuilderConfig = {
  family: string;
  color: string;
  stitch: string;
  flap: string;
  handles: string;
  strap: string;
  hardware: string;
  accent: string;
};

const MATERIAL = "Sznurek poliestrowy · Pimiotki";

const FAMILY_LABELS: Record<string, string> = {
  tote: "Prostokątna",
  round: "Półokrągła",
  bucket: "Kubełkowa",
  mini: "Mini",
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

const STITCH_LABELS: Record<string, string> = {
  classic: "Klasyczny",
  herringbone: "Jodełka",
  basket: "Koszykowy",
  shell: "Muszla",
};

const FLAP_LABELS: Record<string, string> = {
  none: "Bez klapy",
  crochet: "Szydełkowa",
  "leather-black": "Skórzana czarna",
  "leather-cognac": "Skórzana koniak",
  "suede-burgundy": "Zamszowa bordo",
};

const HANDLE_LABELS: Record<string, string> = {
  none: "Bez uchwytu",
  "wood-light": "Drewno jasne",
  "wood-dark": "Drewno ciemne",
  crochet: "Uchwyt szydełkowy",
};

const STRAP_LABELS: Record<string, string> = {
  none: "Bez paska",
  leather: "Pasek skórzany",
  woven: "Pasek tkany",
  chain: "Łańcuszek",
};

const HARDWARE_LABELS: Record<string, string> = {
  gold: "Złote",
  silver: "Srebrne",
  black: "Czarne",
};

const ACCENT_LABELS: Record<string, string> = {
  none: "Bez ozdoby",
  tassel: "Chwost",
  scarf: "Apaszka / kokarda",
  charm: "Zawieszka",
};

function readConfig(stage: HTMLElement): BuilderConfig {
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

function label(map: Record<string, string>, value: string, fallback = "Nie wybrano") {
  return map[value] || fallback;
}

function projectCode(config: BuilderConfig) {
  const signature = Object.values(config).join("|");
  let hash = 2166136261;
  for (let index = 0; index < signature.length; index += 1) {
    hash ^= signature.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `AB-${(hash >>> 0).toString(36).toUpperCase().padStart(7, "0").slice(-7)}`;
}

function specification(config: BuilderConfig) {
  const code = projectCode(config);
  return [
    `A-Bags · projekt ${code}`,
    `Materiał: ${MATERIAL}`,
    `Fason: ${label(FAMILY_LABELS, config.family)}`,
    `Kolor sznurka: ${label(COLOR_LABELS, config.color)}`,
    `Splot / ścieg: ${label(STITCH_LABELS, config.stitch)}`,
    `Klapa: ${label(FLAP_LABELS, config.flap)}`,
    `Uchwyty: ${label(HANDLE_LABELS, config.handles)}`,
    `Pasek: ${label(STRAP_LABELS, config.strap)}`,
    `Okucia: ${label(HARDWARE_LABELS, config.hardware)}`,
    `Detal / ozdoba: ${label(ACCENT_LABELS, config.accent)}`,
    "Cena personalizacji: do indywidualnego potwierdzenia przez pracownię.",
  ].join("\n");
}

function copyFallback(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  return copyFallback(text);
}

function ensureReviewCard(controls: HTMLElement, config: BuilderConfig) {
  const actions = controls.querySelector<HTMLElement>(".abags-builder-actions");
  if (!actions) return;

  let card = controls.querySelector<HTMLElement>("[data-builder-project-review]");
  if (!card) {
    card = document.createElement("div");
    card.className = "abags-builder-summary";
    card.dataset.builderProjectReview = "true";
    card.setAttribute("aria-live", "polite");
    actions.insertAdjacentElement("beforebegin", card);
  }

  const code = projectCode(config);
  const complete = Boolean(config.family && config.color && config.stitch);
  const content = `${code}|${Object.values(config).join("|")}|${complete}`;
  if (card.dataset.reviewSignature === content) return;
  card.dataset.reviewSignature = content;

  const heading = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = "Pełna specyfikacja projektu";
  const status = document.createElement("span");
  status.textContent = complete ? `kod ${code}` : "uzupełnij podstawę projektu";
  heading.append(title, status);

  const summary = document.createElement("p");
  summary.textContent = complete
    ? `${label(FAMILY_LABELS, config.family)} · ${label(COLOR_LABELS, config.color)} · ${label(STITCH_LABELS, config.stitch)} · ${label(FLAP_LABELS, config.flap)} · ${label(HANDLE_LABELS, config.handles)} · ${label(STRAP_LABELS, config.strap)} · ${label(HARDWARE_LABELS, config.hardware)} · ${label(ACCENT_LABELS, config.accent)}`
    : "Wybierz fason, kolor sznurka i splot, aby otrzymać kompletną specyfikację.";

  const material = document.createElement("small");
  material.textContent = `${MATERIAL}. Kod projektu zmienia się automatycznie wraz z konfiguracją.`;

  card.replaceChildren(heading, summary, material);
}

function ensureCopyButton(controls: HTMLElement, stage: HTMLElement) {
  const actions = controls.querySelector<HTMLElement>(".abags-builder-actions");
  if (!actions) return;

  let button = actions.querySelector<HTMLButtonElement>("[data-builder-copy-spec]");
  if (!button) {
    button = document.createElement("button");
    button.type = "button";
    button.dataset.builderCopySpec = "true";
    button.textContent = "Kopiuj specyfikację";
    const send = actions.querySelector("a");
    if (send) actions.insertBefore(button, send);
    else actions.appendChild(button);

    button.addEventListener("click", async () => {
      const current = readConfig(stage);
      if (!(current.family && current.color && current.stitch)) return;
      const original = "Kopiuj specyfikację";
      try {
        const copied = await copyText(specification(current));
        button!.textContent = copied ? "Skopiowano ✓" : "Nie udało się skopiować";
      } catch {
        button!.textContent = "Nie udało się skopiować";
      }
      window.setTimeout(() => { if (button) button.textContent = original; }, 1800);
    });
  }

  const config = readConfig(stage);
  button.disabled = !(config.family && config.color && config.stitch);
  button.setAttribute("aria-disabled", button.disabled ? "true" : "false");
}

function synchronize() {
  const stage = document.querySelector<HTMLElement>(".abags-bag-builder-stage");
  const controls = document.querySelector<HTMLElement>(".abags-builder-controls");
  if (!stage || !controls) return;
  const config = readConfig(stage);
  ensureReviewCard(controls, config);
  ensureCopyButton(controls, stage);
}

export default function BagBuilderProjectReview() {
  useEffect(() => {
    synchronize();
    const observer = new MutationObserver(synchronize);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-family", "data-color", "data-stitch", "data-flap", "data-handles", "data-strap", "data-hardware", "data-accent"],
    });

    return () => {
      observer.disconnect();
      document.querySelector("[data-builder-project-review]")?.remove();
      document.querySelector("[data-builder-copy-spec]")?.remove();
    };
  }, []);

  return null;
}
