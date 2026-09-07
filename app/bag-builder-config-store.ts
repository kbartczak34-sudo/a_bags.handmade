"use client";

import { useSyncExternalStore } from "react";

export type BagBuilderClientConfig = {
  family: "" | "tote" | "round" | "bucket" | "mini";
  color: string;
  stitch: "" | "classic" | "herringbone" | "basket" | "shell";
  flap: "none" | "crochet" | "leather-black" | "leather-cognac" | "suede-burgundy";
  handles: "none" | "wood-light" | "wood-dark" | "crochet";
  strap: "none" | "leather" | "woven" | "chain";
  hardware: "gold" | "silver" | "black";
  accent: "none" | "tassel" | "scarf" | "charm";
  baseProductId: string;
};

export type BagBuilderDraftConfig = Omit<BagBuilderClientConfig, "baseProductId">;

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
const STITCHES = new Set<BagBuilderClientConfig["stitch"]>(["", "classic", "herringbone", "basket", "shell"]);
const FLAPS = new Set<BagBuilderClientConfig["flap"]>(["none", "crochet", "leather-black", "leather-cognac", "suede-burgundy"]);
const HANDLES = new Set<BagBuilderClientConfig["handles"]>(["none", "wood-light", "wood-dark", "crochet"]);
const STRAPS = new Set<BagBuilderClientConfig["strap"]>(["none", "leather", "woven", "chain"]);
const HARDWARE = new Set<BagBuilderClientConfig["hardware"]>(["gold", "silver", "black"]);
const ACCENTS = new Set<BagBuilderClientConfig["accent"]>(["none", "tassel", "scarf", "charm"]);

const STAGE_SELECTOR = ".abags-bag-builder-stage";
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
] as const;

let snapshot = EMPTY_BAG_BUILDER_CLIENT_CONFIG;
let signature = JSON.stringify(snapshot);
let observer: MutationObserver | null = null;
const listeners = new Set<() => void>();

function allowed<T extends string>(value: string | undefined, values: ReadonlySet<T>, fallback: T): T {
  return value && values.has(value as T) ? value as T : fallback;
}

function normalizedColor(value: string | undefined) {
  const color = value?.trim() ?? "";
  return !color || /^#[0-9A-Fa-f]{6}$/.test(color) ? color : "";
}

function normalizedBaseProductId(value: string | undefined) {
  const id = value?.trim() ?? "";
  return !id || /^[a-zA-Z0-9-]{1,80}$/.test(id) ? id : "";
}

export function readBagBuilderClientConfig(stage: HTMLElement): BagBuilderClientConfig {
  return {
    family: allowed(stage.dataset.family, FAMILIES, ""),
    color: normalizedColor(stage.dataset.color),
    stitch: allowed(stage.dataset.stitch, STITCHES, ""),
    flap: allowed(stage.dataset.flap, FLAPS, "none"),
    handles: allowed(stage.dataset.handles, HANDLES, "none"),
    strap: allowed(stage.dataset.strap, STRAPS, "none"),
    hardware: allowed(stage.dataset.hardware, HARDWARE, "gold"),
    accent: allowed(stage.dataset.accent, ACCENTS, "none"),
    baseProductId: normalizedBaseProductId(stage.dataset.photoProductId),
  };
}

export function toBagBuilderDraftConfig(config: BagBuilderClientConfig): BagBuilderDraftConfig {
  const { baseProductId: _baseProductId, ...draft } = config;
  return draft;
}

function synchronize() {
  const stage = document.querySelector<HTMLElement>(STAGE_SELECTOR);
  const next = stage ? readBagBuilderClientConfig(stage) : EMPTY_BAG_BUILDER_CLIENT_CONFIG;
  const nextSignature = JSON.stringify(next);
  if (nextSignature === signature) return;

  snapshot = next;
  signature = nextSignature;
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

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return EMPTY_BAG_BUILDER_CLIENT_CONFIG;
}

export function useBagBuilderClientConfig() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
