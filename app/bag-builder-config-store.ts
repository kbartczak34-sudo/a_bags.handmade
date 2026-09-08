"use client";

import { useSyncExternalStore } from "react";

export type BagBuilderClientConfig = {
  family: "" | "tote" | "round" | "bucket" | "mini";
  color: "" | "#E8DDCC" | "#E4A9B5" | "#24324D" | "#65493D" | "#C7962F" | "#222124" | "#B93A42" | "#275C4A" | "#087E81" | "#A88AE0";
  stitch: "" | "classic" | "herringbone" | "basket" | "shell";
  flap: "none" | "crochet" | "leather-black" | "leather-cognac" | "suede-burgundy";
  handles: "none" | "wood-light" | "wood-dark" | "crochet";
  strap: "none" | "leather" | "woven" | "chain";
  hardware: "gold" | "silver" | "black";
  accent: "none" | "tassel" | "scarf" | "charm";
  baseProductId: string;
};

export type BagBuilderDraftConfig = Omit<BagBuilderClientConfig, "baseProductId">;
export type BagBuilderConfigKey = keyof BagBuilderDraftConfig;

export type BagBuilderClientState = {
  config: BagBuilderClientConfig;
  invalidKeys: BagBuilderConfigKey[];
  photoTrueActive: boolean;
};

export const BAG_BUILDER_CONFIG_ORDER: BagBuilderConfigKey[] = [
  "family",
  "color",
  "stitch",
  "flap",
  "handles",
  "strap",
  "hardware",
  "accent",
];

export const EMPTY_BAG_BUILDER_CLIENT_CONFIG: BagBuilderClientConfig = {
  family: "",
  color: "",
  stitch: "",
  flap: "none",
  handles: "none",
  strap: "none",
  hardware: "gold",
  accent: "none",
  baseProductId: "",
};

const FAMILIES = new Set<BagBuilderClientConfig["family"]>(["", "tote", "round", "bucket", "mini"]);
const COLORS = new Set<BagBuilderClientConfig["color"]>(["", "#E8DDCC", "#E4A9B5", "#24324D", "#65493D", "#C7962F", "#222124", "#B93A42", "#275C4A", "#087E81", "#A88AE0"]);
const STITCHES = new Set<BagBuilderClientConfig["stitch"]>(["", "classic", "herringbone", "basket", "shell"]);
const FLAPS = new Set<BagBuilderClientConfig["flap"]>(["none", "crochet", "leather-black", "leather-cognac", "suede-burgundy"]);
const HANDLES = new Set<BagBuilderClientConfig["handles"]>(["none", "wood-light", "wood-dark", "crochet"]);
const STRAPS = new Set<BagBuilderClientConfig["strap"]>(["none", "leather", "woven", "chain"]);
const HARDWARE = new Set<BagBuilderClientConfig["hardware"]>(["gold", "silver", "black"]);
const ACCENTS = new Set<BagBuilderClientConfig["accent"]>(["none", "tassel", "scarf", "charm"]);

const ALLOWED: { [K in BagBuilderConfigKey]: ReadonlySet<BagBuilderDraftConfig[K]> } = {
  family: FAMILIES,
  color: COLORS,
  stitch: STITCHES,
  flap: FLAPS,
  handles: HANDLES,
  strap: STRAPS,
  hardware: HARDWARE,
  accent: ACCENTS,
};

const FALLBACKS: BagBuilderDraftConfig = {
  family: "",
  color: "",
  stitch: "",
  flap: "none",
  handles: "none",
  strap: "none",
  hardware: "gold",
  accent: "none",
};

const STAGE_SELECTOR = ".abags-bag-builder-stage";
const DRAFT_STORAGE_KEY = "abags-bag-builder-v3";
const OBSERVED_ATTRIBUTES = [
  "data-family",
  "data-color",
  "data-stitch",
  "data-flap",
  "data-handles",
  "data-strap",
  "data-hardware",
  "data-accent",
  "data-photo-product-id",
  "data-abags-photo-true",
] as const;

const EMPTY_STATE: BagBuilderClientState = {
  config: EMPTY_BAG_BUILDER_CLIENT_CONFIG,
  invalidKeys: [],
  photoTrueActive: false,
};

let stateSnapshot = EMPTY_STATE;
let stateSignature = JSON.stringify(EMPTY_STATE);
let observer: MutationObserver | null = null;
const listeners = new Set<() => void>();

function normalizeField<K extends BagBuilderConfigKey>(key: K, value: string | undefined): BagBuilderDraftConfig[K] {
  const fallback = FALLBACKS[key];
  const candidate = (value ?? fallback) as BagBuilderDraftConfig[K];
  return ALLOWED[key].has(candidate) ? candidate : fallback;
}

export function normalizeBagBuilderDraftInput(input: Partial<Record<BagBuilderConfigKey, string>>) {
  const config = {} as BagBuilderDraftConfig;
  const invalidKeys: BagBuilderConfigKey[] = [];

  for (const key of BAG_BUILDER_CONFIG_ORDER) {
    const fallback = FALLBACKS[key];
    const raw = input[key] ?? fallback;
    const candidate = raw as BagBuilderDraftConfig[typeof key];
    if (!ALLOWED[key].has(candidate as never)) invalidKeys.push(key);
    (config as Record<BagBuilderConfigKey, string>)[key] = normalizeField(key, raw);
  }

  return { config, invalidKeys };
}

export function isBagBuilderDraftConfigComplete(config: BagBuilderDraftConfig) {
  return Boolean(config.family && config.color && config.stitch);
}

export function validBagBuilderBaseProductId(value: string) {
  return value.length > 0 && value.length <= 160 && !/[\u0000-\u001f\u007f]/.test(value);
}

function normalizedBaseProductId(value: string | undefined) {
  const id = value?.trim() ?? "";
  return !id || validBagBuilderBaseProductId(id) ? id : "";
}

function rawDraftFromStage(stage: HTMLElement): Partial<Record<BagBuilderConfigKey, string>> {
  return {
    family: stage.dataset.family,
    color: stage.dataset.color,
    stitch: stage.dataset.stitch,
    flap: stage.dataset.flap,
    handles: stage.dataset.handles,
    strap: stage.dataset.strap,
    hardware: stage.dataset.hardware,
    accent: stage.dataset.accent,
  };
}

function persistNormalizedDraft(config: BagBuilderDraftConfig) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // localStorage can be blocked or full; the in-memory builder must keep working.
  }
}

export function readBagBuilderClientState(stage: HTMLElement): BagBuilderClientState {
  const { config: draft, invalidKeys } = normalizeBagBuilderDraftInput(rawDraftFromStage(stage));
  return {
    config: {
      ...draft,
      baseProductId: normalizedBaseProductId(stage.dataset.photoProductId),
    },
    invalidKeys,
    photoTrueActive: stage.dataset.abagsPhotoTrue === "active",
  };
}

export function readBagBuilderClientConfig(stage: HTMLElement): BagBuilderClientConfig {
  return readBagBuilderClientState(stage).config;
}

export function toBagBuilderDraftConfig(config: BagBuilderClientConfig): BagBuilderDraftConfig {
  const { baseProductId: _baseProductId, ...draft } = config;
  return draft;
}

function synchronize() {
  const stage = document.querySelector<HTMLElement>(STAGE_SELECTOR);
  const next = stage ? readBagBuilderClientState(stage) : EMPTY_STATE;
  const nextSignature = JSON.stringify(next);
  if (nextSignature === stateSignature) return;

  stateSnapshot = next;
  stateSignature = nextSignature;
  if (stage && next.invalidKeys.length === 0) persistNormalizedDraft(toBagBuilderDraftConfig(next.config));
  for (const listener of listeners) listener();
}

function startObserver() {
  if (observer || typeof document === "undefined") return;
  synchronize();
  observer = new MutationObserver(synchronize);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [...OBSERVED_ATTRIBUTES],
  });
}

function stopObserverIfUnused() {
  if (listeners.size > 0) return;
  observer?.disconnect();
  observer = null;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  startObserver();
  return () => {
    listeners.delete(listener);
    stopObserverIfUnused();
  };
}

function getStateSnapshot() {
  return stateSnapshot;
}

function getServerStateSnapshot() {
  return EMPTY_STATE;
}

function getConfigSnapshot() {
  return stateSnapshot.config;
}

function getServerConfigSnapshot() {
  return EMPTY_BAG_BUILDER_CLIENT_CONFIG;
}

export function useBagBuilderClientState() {
  return useSyncExternalStore(subscribe, getStateSnapshot, getServerStateSnapshot);
}

export function useBagBuilderClientConfig() {
  return useSyncExternalStore(subscribe, getConfigSnapshot, getServerConfigSnapshot);
}
