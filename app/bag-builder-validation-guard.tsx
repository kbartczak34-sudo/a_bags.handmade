"use client";

import { useEffect, useMemo, useState } from "react";
import { isAgataBuilderConstructionSupported, type AgataBuilderConstructionKey } from "../lib/abags-builder-fidelity";
import {
  toBagBuilderDraftConfig,
  useBagBuilderClientState,
  type BagBuilderConfigKey,
  type BagBuilderDraftConfig,
} from "./bag-builder-config-store";

const DRAFT_KEY = "abags-bag-builder-v3";

type ConstructionBuilderKey = "flap" | "handles" | "strap" | "accent";

const FALLBACKS: Partial<Record<BagBuilderConfigKey, string>> = {
  flap: "none",
  handles: "none",
  strap: "none",
  hardware: "gold",
  accent: "none",
};

const FIDELITY_KEYS: Record<ConstructionBuilderKey, AgataBuilderConstructionKey> = {
  flap: "flaps",
  handles: "handles",
  strap: "straps",
  accent: "accents",
};

const REQUIRED_LABELS: Array<[BagBuilderConfigKey, string]> = [
  ["family", "fason"],
  ["color", "kolor sznurka"],
  ["stitch", "ścieg szydełkowy"],
];

function fidelityInvalidKeys(snapshot: BagBuilderDraftConfig): ConstructionBuilderKey[] {
  if (!snapshot.family) return [];
  return (Object.keys(FIDELITY_KEYS) as ConstructionBuilderKey[]).filter((key) =>
    !isAgataBuilderConstructionSupported(snapshot.family, FIDELITY_KEYS[key], snapshot[key]),
  );
}

function clickChoice(controls: HTMLElement, key: BagBuilderConfigKey, value: string) {
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

function repairSnapshot(controls: HTMLElement, invalidKeys: BagBuilderConfigKey[]) {
  if (!invalidKeys.length) return false;

  clearStaleDraft();

  const invalidRequired = invalidKeys.some((key) => key === "family" || key === "color" || key === "stitch");
  if (invalidRequired) {
    const reset = controls.querySelector<HTMLButtonElement>(".abags-builder-actions button");
    reset?.click();
    return true;
  }

  invalidKeys.forEach((key) => {
    const fallback = FALLBACKS[key];
    if (fallback) clickChoice(controls, key, fallback);
  });
  return true;
}

function repairKnownCompatibility(controls: HTMLElement, snapshot: BagBuilderDraftConfig) {
  const incompatible = fidelityInvalidKeys(snapshot);
  if (!incompatible.length) return false;
  clearStaleDraft();
  for (const key of incompatible) {
    if (clickChoice(controls, key, "none")) return true;
  }
  return false;
}

function requiredMissing(snapshot: BagBuilderDraftConfig) {
  return REQUIRED_LABELS.filter(([key]) => !snapshot[key]).map(([, label]) => label);
}

function ensureStatusCard(controls: HTMLElement, snapshot: BagBuilderDraftConfig, invalidKeys: BagBuilderConfigKey[]) {
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
  const incompatible = fidelityInvalidKeys(snapshot);
  const ready = missing.length === 0 && invalidKeys.length === 0 && incompatible.length === 0;
  const signature = `${Object.values(snapshot).join("|")}|${missing.join(",")}|${invalidKeys.join(",")}|${incompatible.join(",")}`;
  if (card.dataset.validationSignature === signature) return;
  card.dataset.validationSignature = signature;

  const heading = document.createElement("div");
  const title = document.createElement("strong");
  const badge = document.createElement("span");
  const copy = document.createElement("p");
  const note = document.createElement("small");

  if (invalidKeys.length || incompatible.length) {
    title.textContent = "Sprawdzam zapisany projekt";
    badge.textContent = "korekta danych";
    copy.textContent = incompatible.length
      ? "Wykryto połączenie, którego nie ma w zweryfikowanych konstrukcjach tego fasonu A-Bags. Projekt zostanie przywrócony do konfiguracji zgodnej z referencjami Agaty."
      : "Wykryto nieobsługiwaną wartość z wcześniejszej wersji kreatora. Projekt zostanie przywrócony do bezpiecznej konfiguracji.";
    note.textContent = "Niepoprawny draft nie może zostać wysłany do pracowni.";
  } else if (!ready) {
    title.textContent = "Projekt wymaga uzupełnienia";
    badge.textContent = `${3 - missing.length}/3 podstawy`;
    copy.textContent = `Brakuje: ${missing.join(", ")}.`;
    note.textContent = "Po wyborze fasonu, koloru sznurka i ściegu szydełkowego zapis oraz wysyłka projektu zostaną odblokowane.";
  } else {
    title.textContent = "Projekt gotowy do konsultacji";
    badge.textContent = "walidacja ✓";
    copy.textContent = "Fason, kolor sznurka i ścieg szydełkowy są kompletne, a konstrukcja jest zgodna ze zweryfikowanymi referencjami A-Bags.";
    note.textContent = "Finalna możliwość wykonania i cena personalizacji są potwierdzane przez pracownię.";
  }

  heading.append(title, badge);
  card.replaceChildren(heading, copy, note);
}

export default function BagBuilderValidationGuard() {
  const { config, invalidKeys } = useBagBuilderClientState();
  const snapshot = useMemo(() => toBagBuilderDraftConfig(config), [config]);
  const [controls, setControls] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const attach = () => {
      const next = document.querySelector<HTMLElement>(".abags-builder-controls");
      setControls((current) => current === next ? current : next);
    };

    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      document.querySelector("[data-builder-validation-status]")?.remove();
    };
  }, []);

  useEffect(() => {
    if (!controls) return;
    ensureStatusCard(controls, snapshot, invalidKeys);
    if (repairSnapshot(controls, invalidKeys)) return;
    repairKnownCompatibility(controls, snapshot);
  }, [controls, invalidKeys, snapshot]);

  return null;
}
