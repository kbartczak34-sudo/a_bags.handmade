"use client";

import { useEffect, useRef, useState } from "react";
import {
  toBagBuilderDraftConfig,
  useBagBuilderClientConfig,
  type BagBuilderDraftConfig,
} from "./bag-builder-config-store";

const DRAFT_KEY = "abags-bag-builder-v3";
const AUTOSAVE_DELAY = 240;

function isEmpty(config: BagBuilderDraftConfig) {
  return !config.family
    && !config.color
    && !config.stitch
    && config.flap === "none"
    && config.handles === "none"
    && config.strap === "none"
    && config.hardware === "gold"
    && config.accent === "none";
}

function safeRemove() {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
    return true;
  } catch {
    return false;
  }
}

function safeSave(config: BagBuilderDraftConfig) {
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
  const config = useBagBuilderClientConfig();
  const [controls, setControls] = useState<HTMLElement | null>(null);
  const lastSignature = useRef("");

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
      document.querySelector("[data-builder-autosave-status]")?.remove();
    };
  }, []);

  useEffect(() => {
    if (!controls) return;
    ensureAutosaveNote(controls, "idle");
    if (controls.dataset.builderSharedImport === "loading") return;

    const draft = toBagBuilderDraftConfig(config);
    const signature = JSON.stringify(draft);
    if (signature === lastSignature.current) return;
    lastSignature.current = signature;

    ensureAutosaveNote(controls, "saving");
    const timer = window.setTimeout(() => {
      const ok = isEmpty(draft) ? safeRemove() : safeSave(draft);
      ensureAutosaveNote(controls, ok ? "saved" : "error");
    }, AUTOSAVE_DELAY);

    return () => window.clearTimeout(timer);
  }, [config, controls]);

  return null;
}
