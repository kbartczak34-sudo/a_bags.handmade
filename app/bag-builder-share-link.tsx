"use client";

import { useEffect } from "react";

const DRAFT_KEY = "abags-bag-builder-v3";
const PARAM = "projekt";

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

const ORDER: BuilderKey[] = ["family", "color", "stitch", "flap", "handles", "strap", "hardware", "accent"];

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

function isValid(config: BuilderConfig) {
  return ORDER.every((key) => ALLOWED[key].has(config[key]));
}

function isComplete(config: BuilderConfig) {
  return Boolean(config.family && config.color && config.stitch && isValid(config));
}

function encodeProject(config: BuilderConfig) {
  return [
    "v1",
    config.family,
    config.color.replace(/^#/, ""),
    config.stitch,
    config.flap,
    config.handles,
    config.strap,
    config.hardware,
    config.accent,
  ].join(".");
}

function decodeProject(value: string | null): BuilderConfig | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 9 || parts[0] !== "v1") return null;
  const config: BuilderConfig = {
    family: parts[1],
    color: parts[2] ? `#${parts[2].toUpperCase()}` : "",
    stitch: parts[3],
    flap: parts[4],
    handles: parts[5],
    strap: parts[6],
    hardware: parts[7],
    accent: parts[8],
  };
  return isValid(config) && isComplete(config) ? config : null;
}

function projectUrl(config: BuilderConfig) {
  const url = new URL(window.location.href);
  url.searchParams.set(PARAM, encodeProject(config));
  return url.toString();
}

function fallbackCopy(text: string) {
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
  return fallbackCopy(text);
}

function nextFrame() {
  return new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}

async function waitForStageValue(stage: HTMLElement, key: BuilderKey, value: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if ((stage.dataset[key] || "") === value) return true;
    await nextFrame();
  }
  return false;
}

async function applyChoice(controls: HTMLElement, stage: HTMLElement, key: BuilderKey, value: string) {
  const current = stage.dataset[key] || "";
  if (current === value) return true;

  const selector = `[data-builder-key="${key}"][data-builder-value="${value}"]`;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const button = controls.querySelector<HTMLButtonElement>(selector);
    if (button && !button.disabled) {
      button.click();
      return waitForStageValue(stage, key, value);
    }
    await nextFrame();
  }
  return false;
}

function persistImportedProject(config: BuilderConfig) {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(config));
  } catch {
    // Shared project still remains active for the current session.
  }
}

function removeImportedParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(PARAM)) return;
  url.searchParams.delete(PARAM);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

async function importSharedProject(stage: HTMLElement, controls: HTMLElement, config: BuilderConfig) {
  controls.dataset.builderSharedImport = "loading";
  for (const key of ORDER) {
    const applied = await applyChoice(controls, stage, key, config[key]);
    if (!applied) {
      controls.dataset.builderSharedImport = "error";
      return false;
    }
  }
  persistImportedProject(config);
  removeImportedParam();
  controls.dataset.builderSharedImport = "ready";
  return true;
}

function ensureShareButton(controls: HTMLElement, stage: HTMLElement) {
  const actions = controls.querySelector<HTMLElement>(".abags-builder-actions");
  if (!actions) return;

  let button = actions.querySelector<HTMLButtonElement>("[data-builder-share-project]");
  if (!button) {
    button = document.createElement("button");
    button.type = "button";
    button.dataset.builderShareProject = "true";
    button.textContent = "Udostępnij projekt";
    const send = actions.querySelector("a");
    if (send) actions.insertBefore(button, send);
    else actions.appendChild(button);

    button.addEventListener("click", async () => {
      const config = readConfig(stage);
      if (!isComplete(config)) return;
      const original = "Udostępnij projekt";
      try {
        const copied = await copyText(projectUrl(config));
        button!.textContent = copied ? "Link skopiowany ✓" : "Nie udało się skopiować";
      } catch {
        button!.textContent = "Nie udało się skopiować";
      }
      window.setTimeout(() => { if (button) button.textContent = original; }, 1800);
    });
  }

  const config = readConfig(stage);
  button.disabled = !isComplete(config);
  button.setAttribute("aria-disabled", button.disabled ? "true" : "false");
}

function ensureImportNotice(controls: HTMLElement, state: "loading" | "error" | "ready") {
  const heading = controls.querySelector<HTMLElement>(".abags-builder-heading");
  if (!heading) return;

  let notice = controls.querySelector<HTMLElement>("[data-builder-share-notice]");
  if (!notice) {
    notice = document.createElement("div");
    notice.className = "abags-builder-summary";
    notice.dataset.builderShareNotice = "true";
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "polite");
    heading.insertAdjacentElement("afterend", notice);
  }

  const title = document.createElement("strong");
  const copy = document.createElement("p");
  if (state === "loading") {
    title.textContent = "Otwieram udostępniony projekt";
    copy.textContent = "Przenoszę zapisane wybory do kreatora…";
  } else if (state === "error") {
    title.textContent = "Nie udało się odtworzyć projektu";
    copy.textContent = "Link zawiera konfigurację, której nie można zastosować w aktualnej wersji kreatora.";
  } else {
    title.textContent = "Udostępniony projekt został otwarty";
    copy.textContent = "Możesz dalej zmieniać jego elementy, zapisać projekt lub wysłać go do pracowni.";
  }
  notice.replaceChildren(title, copy);
  if (state === "ready") window.setTimeout(() => notice?.remove(), 2600);
}

export default function BagBuilderShareLink() {
  useEffect(() => {
    let cancelled = false;
    let importStarted = false;

    const synchronize = async () => {
      const stage = document.querySelector<HTMLElement>(".abags-bag-builder-stage");
      const controls = document.querySelector<HTMLElement>(".abags-builder-controls");
      if (!stage || !controls || cancelled) return;

      ensureShareButton(controls, stage);

      if (!importStarted) {
        const encoded = new URL(window.location.href).searchParams.get(PARAM);
        if (encoded) {
          importStarted = true;
          const config = decodeProject(encoded);
          if (!config) {
            controls.dataset.builderSharedImport = "error";
            ensureImportNotice(controls, "error");
          } else {
            ensureImportNotice(controls, "loading");
            const applied = await importSharedProject(stage, controls, config);
            if (!cancelled) ensureImportNotice(controls, applied ? "ready" : "error");
          }
        }
      }
    };

    void synchronize();
    const observer = new MutationObserver(() => { void synchronize(); });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-family", "data-color", "data-stitch", "data-flap", "data-handles", "data-strap", "data-hardware", "data-accent"],
    });

    return () => {
      cancelled = true;
      observer.disconnect();
      document.querySelector("[data-builder-share-project]")?.remove();
      document.querySelector("[data-builder-share-notice]")?.remove();
    };
  }, []);

  return null;
}
