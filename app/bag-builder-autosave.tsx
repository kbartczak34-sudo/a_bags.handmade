"use client";

import { useEffect } from "react";

const DRAFT_KEY = "abags-bag-builder-v3";
const AUTOSAVE_DELAY = 240;

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

type BuilderKey = keyof BuilderConfig;

const ALLOWED: Record<BuilderKey, Set<string>> = {
  family: new Set(["", "tote", "round", "bucket", "mini"]),
  color: new Set(["", "#E8DDCC", "#E4A9B5", "#24324D", "#65493D", "#C7962F", "#222124", "#B93A42", "#275C4A", "#087E81", "#A88AE0"]),
  stitch: new Set(["", "classic", "herringbone", "basket", "shell"]),
  flap: new Set(["none", "crochet", "leather-black", "leather-cognac", "suede-burgundy"]),
  handles: new Set(["none", "wood-light", "wood-dark", "crochet"]),
  strap: new Set(["none", "leather", "woven", "chain"]),
  hardware: new Set(["gold", "silver", "black"]),
  accent: new Set(["none", "tassel", "scarf", "charm"]),
};

const KEYS = Object.keys(ALLOWED) as BuilderKey[];

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

function valid(config: BuilderConfig) {
  return KEYS.every((key) => ALLOWED[key].has(config[key]));
}

function isEmpty(config: BuilderConfig) {
  return !config.family && !config.color && !config.stitch && config.flap === "none" && config.handles === "none" && config.strap === "none" && config.hardware === "gold" && config.accent === "none";
}

function safeRemove() {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
    return true;
  } catch {
    return false;
  }
}

function safeSave(config: BuilderConfig) {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(config));
    return true;
  } catch {
    return false;
  }
}

function ensureAutosaveNote(controls: HTMLElement, state: "idle" | "saving" | "saved" | "error") {
  const validation = controls.querySelector<HTMLElement>("[data-builder-validation-status]");
  if (!validation) return;

  let note = validation.querySelector<HTMLElement>("[data-builder-autosave-status]");
  if (!note) {
    note = document.createElement("small");
    note.dataset.builderAutosaveStatus = "idle";
    validation.appendChild(note);
  }

  if (note.dataset.builderAutosaveStatus === state) return;
  note.dataset.builderAutosaveStatus = state;
  if (state === "saving") note.textContent = "Zapisuję wersję roboczą…";
  else if (state === "saved") note.textContent = "Wersja robocza zapisana automatycznie ✓";
  else if (state === "error") note.textContent = "Automatyczny zapis jest niedostępny w tej przeglądarce.";
  else note.textContent = "Wersja robocza zapisuje się automatycznie na tym urządzeniu.";
}

export default function BagBuilderAutosave() {
  useEffect(() => {
    let timer = 0;
    let lastSignature = "";

    const synchronize = () => {
      const stage = document.querySelector<HTMLElement>(".abags-bag-builder-stage");
      const controls = document.querySelector<HTMLElement>(".abags-builder-controls");
      if (!stage || !controls) return;

      ensureAutosaveNote(controls, "idle");
      if (controls.dataset.builderSharedImport === "loading") return;

      const config = readConfig(stage);
      if (!valid(config)) return;
      const signature = JSON.stringify(config);
      if (signature === lastSignature) return;
      lastSignature = signature;

      window.clearTimeout(timer);
      ensureAutosaveNote(controls, "saving");
      timer = window.setTimeout(() => {
        const ok = isEmpty(config) ? safeRemove() : safeSave(config);
        ensureAutosaveNote(controls, ok ? "saved" : "error");
      }, AUTOSAVE_DELAY);
    };

    synchronize();
    const observer = new MutationObserver(synchronize);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-family", "data-color", "data-stitch", "data-flap", "data-handles", "data-strap", "data-hardware", "data-accent"],
    });

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      document.querySelector("[data-builder-autosave-status]")?.remove();
    };
  }, []);

  return null;
}
