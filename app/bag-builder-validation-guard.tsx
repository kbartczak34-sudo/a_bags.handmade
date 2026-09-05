"use client";

import { useEffect } from "react";
import { isAgataBuilderHandleSupported } from "../lib/abags-builder-fidelity";

const DRAFT_KEY = "abags-bag-builder-v3";

const ALLOWED = {
  family: new Set(["", "tote", "round", "bucket", "mini"]),
  color: new Set(["", "#E8DDCC", "#E4A9B5", "#24324D", "#65493D", "#C7962F", "#222124", "#B93A42", "#275C4A", "#087E81", "#A88AE0"]),
  stitch: new Set(["", "classic", "herringbone", "basket", "shell"]),
  flap: new Set(["none", "crochet", "leather-black", "leather-cognac", "suede-burgundy"]),
  handles: new Set(["none", "wood-light", "wood-dark", "crochet"]),
  strap: new Set(["none", "leather", "woven", "chain"]),
  hardware: new Set(["gold", "silver", "black"]),
  accent: new Set(["none", "tassel", "scarf", "charm"]),
} as const;

type BuilderKey = keyof typeof ALLOWED;
type BuilderSnapshot = Record<BuilderKey, string>;

const FALLBACKS: Partial<Record<BuilderKey, string>> = {
  flap: "none",
  handles: "none",
  strap: "none",
  hardware: "gold",
  accent: "none",
};

const REQUIRED_LABELS: Array<[BuilderKey, string]> = [
  ["family", "fason"],
  ["color", "kolor sznurka"],
  ["stitch", "ścieg szydełkowy"],
];

function readSnapshot(stage: HTMLElement): BuilderSnapshot {
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

function invalidKeys(snapshot: BuilderSnapshot) {
  return (Object.keys(ALLOWED) as BuilderKey[]).filter((key) => !ALLOWED[key].has(snapshot[key] as never));
}

function clickChoice(controls: HTMLElement, key: BuilderKey, value: string) {
  const selector = `[data-builder-key="${key}"][data-builder-value="${value}"]`;
  const button = controls.querySelector<HTMLButtonElement>(selector);
  if (!button || button.disabled) return false;
  button.click();
  return true;
}

function clearStaleDraft() {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // The live builder can still be repaired even when storage is unavailable.
  }
}

function repairSnapshot(controls: HTMLElement, snapshot: BuilderSnapshot) {
  const invalid = invalidKeys(snapshot);
  if (!invalid.length) return false;

  clearStaleDraft();

  const invalidRequired = invalid.some((key) => key === "family" || key === "color" || key === "stitch");
  if (invalidRequired) {
    const reset = controls.querySelector<HTMLButtonElement>(".abags-builder-actions button");
    reset?.click();
    return true;
  }

  invalid.forEach((key) => {
    const fallback = FALLBACKS[key];
    if (fallback) clickChoice(controls, key, fallback);
  });
  return true;
}

function repairKnownCompatibility(controls: HTMLElement, snapshot: BuilderSnapshot) {
  if (snapshot.family && !isAgataBuilderHandleSupported(snapshot.family, snapshot.handles)) {
    clearStaleDraft();
    return clickChoice(controls, "handles", "none");
  }
  return false;
}

function requiredMissing(snapshot: BuilderSnapshot) {
  return REQUIRED_LABELS.filter(([key]) => !snapshot[key]).map(([, label]) => label);
}

function ensureStatusCard(controls: HTMLElement, snapshot: BuilderSnapshot) {
  const actions = controls.querySelector<HTMLElement>(".abags-builder-actions");
  if (!actions) return;

  let card = controls.querySelector<HTMLElement>("[data-builder-validation-status]");
  if (!card) {
    card = document.createElement("div");
    card.className = "abags-builder-summary";
    card.dataset.builderValidationStatus = "true";
    card.setAttribute("role", "status");
    card.setAttribute("aria-live", "polite");
    actions.insertAdjacentElement("beforebegin", card);
  }

  const missing = requiredMissing(snapshot);
  const invalid = invalidKeys(snapshot);
  const ready = missing.length === 0 && invalid.length === 0;
  const signature = `${Object.values(snapshot).join("|")}|${missing.join(",")}|${invalid.join(",")}`;
  if (card.dataset.validationSignature === signature) return;
  card.dataset.validationSignature = signature;

  const heading = document.createElement("div");
  const title = document.createElement("strong");
  const badge = document.createElement("span");
  const copy = document.createElement("p");
  const note = document.createElement("small");

  if (invalid.length) {
    title.textContent = "Sprawdzam zapisany projekt";
    badge.textContent = "korekta danych";
    copy.textContent = "Wykryto nieobsługiwaną wartość z wcześniejszej wersji kreatora. Projekt zostanie przywrócony do bezpiecznej konfiguracji.";
    note.textContent = "Niepoprawny draft nie może zostać wysłany do pracowni.";
  } else if (!ready) {
    title.textContent = "Projekt wymaga uzupełnienia";
    badge.textContent = `${3 - missing.length}/3 podstawy`;
    copy.textContent = `Brakuje: ${missing.join(", ")}.`;
    note.textContent = "Po wyborze fasonu, koloru sznurka i ściegu szydełkowego zapis oraz wysyłka projektu zostaną odblokowane.";
  } else {
    title.textContent = "Projekt gotowy do konsultacji";
    badge.textContent = "walidacja ✓";
    copy.textContent = "Fason, kolor sznurka i ścieg szydełkowy są kompletne, a wartości konfiguracji są obsługiwane przez aktualną wersję Bag Buildera.";
    note.textContent = "Finalna możliwość wykonania i cena personalizacji są potwierdzane przez pracownię.";
  }

  heading.append(title, badge);
  card.replaceChildren(heading, copy, note);
}

function synchronize() {
  const stage = document.querySelector<HTMLElement>(".abags-bag-builder-stage");
  const controls = document.querySelector<HTMLElement>(".abags-builder-controls");
  if (!stage || !controls) return;

  const snapshot = readSnapshot(stage);
  ensureStatusCard(controls, snapshot);

  if (repairSnapshot(controls, snapshot)) return;
  repairKnownCompatibility(controls, snapshot);
}

export default function BagBuilderValidationGuard() {
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
      document.querySelector("[data-builder-validation-status]")?.remove();
    };
  }, []);

  return null;
}