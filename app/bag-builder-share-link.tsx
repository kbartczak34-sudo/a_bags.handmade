"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  BAG_BUILDER_CONFIG_ORDER,
  isBagBuilderDraftConfigComplete,
  normalizeBagBuilderDraftInput,
  readBagBuilderClientConfig,
  toBagBuilderDraftConfig,
  useBagBuilderClientState,
  validBagBuilderBaseProductId,
  type BagBuilderConfigKey,
  type BagBuilderDraftConfig,
} from "./bag-builder-config-store";

const DRAFT_KEY = "abags-bag-builder-v3";
const PHOTO_MODEL_KEY = "abags-photo-true-v1";
const PARAM = "projekt";
const MODEL_PARAM = "model";

function encodeProject(config: BagBuilderDraftConfig) {
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

function decodeProject(value: string | null): BagBuilderDraftConfig | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 9 || parts[0] !== "v1") return null;

  const { config, invalidKeys } = normalizeBagBuilderDraftInput({
    family: parts[1],
    color: parts[2] ? `#${parts[2].toUpperCase()}` : "",
    stitch: parts[3],
    flap: parts[4],
    handles: parts[5],
    strap: parts[6],
    hardware: parts[7],
    accent: parts[8],
  });

  return invalidKeys.length === 0 && isBagBuilderDraftConfigComplete(config) ? config : null;
}

function projectUrl(config: BagBuilderDraftConfig, photoTrueActive: boolean, baseProductId: string) {
  const url = new URL(window.location.href);
  url.searchParams.set(PARAM, encodeProject(config));
  if (photoTrueActive && validBagBuilderBaseProductId(baseProductId)) url.searchParams.set(MODEL_PARAM, baseProductId);
  else url.searchParams.delete(MODEL_PARAM);
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

async function waitForStageValue(stage: HTMLElement, key: BagBuilderConfigKey, value: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if ((stage.dataset[key] || "") === value) return true;
    await nextFrame();
  }
  return false;
}

async function applyChoice(controls: HTMLElement, stage: HTMLElement, key: BagBuilderConfigKey, value: string) {
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

async function applyPhotoProduct(stage: HTMLElement, modelId: string) {
  if (!modelId) return true;
  if (!validBagBuilderBaseProductId(modelId)) return false;
  if (stage.dataset.photoProductId === modelId) return true;

  for (let attempt = 0; attempt < 120; attempt += 1) {
    const button = [...document.querySelectorAll<HTMLButtonElement>("[data-photo-product-choice]")]
      .find((candidate) => candidate.dataset.photoProductChoice === modelId);
    if (button && !button.disabled) {
      button.click();
      for (let wait = 0; wait < 60; wait += 1) {
        if (stage.dataset.photoProductId === modelId) return true;
        await nextFrame();
      }
      return false;
    }
    await nextFrame();
  }
  return false;
}

function persistImportedProject(config: BagBuilderDraftConfig, modelId: string) {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(config));
    if (modelId) window.localStorage.setItem(PHOTO_MODEL_KEY, modelId);
  } catch {
    // Shared project still remains active for the current session.
  }
}

function removeImportedParams() {
  const url = new URL(window.location.href);
  let changed = false;
  for (const param of [PARAM, MODEL_PARAM]) {
    if (!url.searchParams.has(param)) continue;
    url.searchParams.delete(param);
    changed = true;
  }
  if (changed) window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

async function importSharedProject(stage: HTMLElement, controls: HTMLElement, config: BagBuilderDraftConfig, modelId: string) {
  controls.dataset.builderSharedImport = "loading";

  // In Photo-True links the real product is authoritative. Selecting it first
  // lets the existing compatibility bridge derive its internal family without
  // exposing or trusting the old generic silhouette as the model identity.
  if (modelId) {
    const modelApplied = await applyPhotoProduct(stage, modelId);
    if (!modelApplied) {
      controls.dataset.builderSharedImport = "error";
      return false;
    }
  }

  const keys = modelId ? BAG_BUILDER_CONFIG_ORDER.filter((key) => key !== "family") : BAG_BUILDER_CONFIG_ORDER;
  for (const key of keys) {
    const applied = await applyChoice(controls, stage, key, config[key]);
    if (!applied) {
      controls.dataset.builderSharedImport = "error";
      return false;
    }
  }

  const finalConfig = toBagBuilderDraftConfig(readBagBuilderClientConfig(stage));
  persistImportedProject(finalConfig, modelId);
  removeImportedParams();
  controls.dataset.builderSharedImport = "ready";
  return true;
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
    copy.textContent = "Przenoszę zapisany model A-Bags i personalizację do kreatora…";
  } else if (state === "error") {
    title.textContent = "Nie udało się odtworzyć projektu";
    copy.textContent = "Link zawiera model lub konfigurację, których nie można zastosować w aktualnej wersji kreatora.";
  } else {
    title.textContent = "Udostępniony projekt został otwarty";
    copy.textContent = "Rzeczywisty model bazowy i jego wybory zostały odtworzone. Możesz dalej edytować projekt.";
  }
  notice.replaceChildren(title, copy);
  if (state === "ready") window.setTimeout(() => notice?.remove(), 2600);
}

export default function BagBuilderShareLink() {
  const { config, invalidKeys, photoTrueActive } = useBagBuilderClientState();
  const draft = useMemo(() => toBagBuilderDraftConfig(config), [config]);
  const latest = useRef({ draft, invalidKeys, photoTrueActive, baseProductId: config.baseProductId });

  useEffect(() => {
    latest.current = { draft, invalidKeys, photoTrueActive, baseProductId: config.baseProductId };

    const button = document.querySelector<HTMLButtonElement>("[data-builder-share-project]");
    if (!button) return;
    const photoReady = !photoTrueActive || Boolean(config.baseProductId);
    button.disabled = invalidKeys.length > 0 || !isBagBuilderDraftConfigComplete(draft) || !photoReady;
    button.setAttribute("aria-disabled", button.disabled ? "true" : "false");
  }, [config.baseProductId, draft, invalidKeys, photoTrueActive]);

  useEffect(() => {
    let cancelled = false;
    let importStarted = false;
    let attachedButton: HTMLButtonElement | null = null;

    const handleClick = async () => {
      const current = latest.current;
      const photoReady = !current.photoTrueActive || Boolean(current.baseProductId);
      const ready = current.invalidKeys.length === 0 && isBagBuilderDraftConfigComplete(current.draft) && photoReady;
      if (!ready || !attachedButton) return;

      const original = "Udostępnij projekt";
      try {
        const copied = await copyText(projectUrl(current.draft, current.photoTrueActive, current.baseProductId));
        attachedButton.textContent = copied ? "Link skopiowany ✓" : "Nie udało się skopiować";
      } catch {
        attachedButton.textContent = "Nie udało się skopiować";
      }
      window.setTimeout(() => {
        if (attachedButton) attachedButton.textContent = original;
      }, 1800);
    };

    const synchronize = () => {
      const stage = document.querySelector<HTMLElement>(".abags-bag-builder-stage");
      const controls = document.querySelector<HTMLElement>(".abags-builder-controls");
      if (!stage || !controls || cancelled) return;

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
      }

      if (attachedButton !== button) {
        attachedButton?.removeEventListener("click", handleClick);
        attachedButton = button;
        attachedButton.addEventListener("click", handleClick);
      }

      const current = latest.current;
      const photoReady = !current.photoTrueActive || Boolean(current.baseProductId);
      button.disabled = current.invalidKeys.length > 0 || !isBagBuilderDraftConfigComplete(current.draft) || !photoReady;
      button.setAttribute("aria-disabled", button.disabled ? "true" : "false");

      if (importStarted) return;
      const url = new URL(window.location.href);
      const encoded = url.searchParams.get(PARAM);
      const rawModelId = url.searchParams.get(MODEL_PARAM) || "";
      if (!encoded) return;

      importStarted = true;
      const sharedConfig = decodeProject(encoded);
      const modelId = rawModelId && validBagBuilderBaseProductId(rawModelId) ? rawModelId : "";
      if (!sharedConfig || (rawModelId && !modelId)) {
        controls.dataset.builderSharedImport = "error";
        ensureImportNotice(controls, "error");
        return;
      }

      ensureImportNotice(controls, "loading");
      void importSharedProject(stage, controls, sharedConfig, modelId).then((applied) => {
        if (!cancelled) ensureImportNotice(controls, applied ? "ready" : "error");
      });
    };

    synchronize();
    const observer = new MutationObserver(synchronize);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelled = true;
      observer.disconnect();
      attachedButton?.removeEventListener("click", handleClick);
      document.querySelector("[data-builder-share-project]")?.remove();
      document.querySelector("[data-builder-share-notice]")?.remove();
    };
  }, []);

  return null;
}
