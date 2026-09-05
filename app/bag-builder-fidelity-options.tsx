"use client";

import { useEffect } from "react";
import { isAgataBuilderConstructionSupported, type AgataBuilderConstructionKey } from "../lib/abags-builder-fidelity";

type BuilderKey = "flap" | "handles" | "strap" | "accent";

const FIDELITY_KEYS: Record<BuilderKey, AgataBuilderConstructionKey> = {
  flap: "flaps",
  handles: "handles",
  strap: "straps",
  accent: "accents",
};

const KEYS = Object.keys(FIDELITY_KEYS) as BuilderKey[];

function syncFidelityOptions() {
  const stage = document.querySelector<HTMLElement>(".abags-bag-builder-stage");
  const controls = document.querySelector<HTMLElement>(".abags-builder-controls");
  if (!stage || !controls) return;

  const family = stage.dataset.family || "";
  if (!family) {
    controls.removeAttribute("data-abags-fidelity-options");
    return;
  }

  for (const key of KEYS) {
    const evidenceKey = FIDELITY_KEYS[key];
    controls.querySelectorAll<HTMLButtonElement>(`button[data-builder-key="${key}"]`).forEach((button) => {
      const value = button.dataset.builderValue || "";
      const supported = isAgataBuilderConstructionSupported(family, evidenceKey, value);
      button.disabled = !supported;
      button.classList.toggle("is-fidelity-incompatible", !supported);
      button.setAttribute("aria-disabled", supported ? "false" : "true");
      if (!supported) {
        button.title = "Ta opcja nie występuje w zweryfikowanych konstrukcjach tego fasonu A-Bags.";
      } else if (button.title === "Ta opcja nie występuje w zweryfikowanych konstrukcjach tego fasonu A-Bags.") {
        button.removeAttribute("title");
      }
    });

    const selected = stage.dataset[key] || "none";
    if (isAgataBuilderConstructionSupported(family, evidenceKey, selected)) continue;
    const fallback = controls.querySelector<HTMLButtonElement>(`button[data-builder-key="${key}"][data-builder-value="none"]`);
    if (fallback && !fallback.disabled) fallback.click();
  }

  controls.dataset.abagsFidelityOptions = "ready";
}

export default function BagBuilderFidelityOptions() {
  useEffect(() => {
    let frame = 0;
    const requestSync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        syncFidelityOptions();
      });
    };

    requestSync();
    const observer = new MutationObserver(requestSync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-family", "data-flap", "data-handles", "data-strap", "data-accent"],
    });

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      document.querySelector<HTMLElement>(".abags-builder-controls")?.removeAttribute("data-abags-fidelity-options");
    };
  }, []);

  return null;
}