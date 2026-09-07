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

export function readBagBuilderClientConfig(stage: HTMLElement): BagBuilderClientConfig {
  return {
    family: (stage.dataset.family || "") as BagBuilderClientConfig["family"],
    color: stage.dataset.color || "",
    stitch: (stage.dataset.stitch || "") as BagBuilderClientConfig["stitch"],
    flap: (stage.dataset.flap || "none") as BagBuilderClientConfig["flap"],
    handles: (stage.dataset.handles || "none") as BagBuilderClientConfig["handles"],
    strap: (stage.dataset.strap || "none") as BagBuilderClientConfig["strap"],
    hardware: (stage.dataset.hardware || "gold") as BagBuilderClientConfig["hardware"],
    accent: (stage.dataset.accent || "none") as BagBuilderClientConfig["accent"],
    baseProductId: stage.dataset.photoProductId || "",
  };
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
