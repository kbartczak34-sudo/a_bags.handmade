"use client";

import { useSyncExternalStore, type ReactNode } from "react";

function subscribe() {
  return () => {};
}

function readQaMode() {
  if (typeof window === "undefined") return false;
  const explicitQa = new URLSearchParams(window.location.search).get("photoTrueQa") === "1";
  const automatedQa = navigator.webdriver === true;
  return explicitQa || automatedQa;
}

/**
 * Photo-True is a reference/QA aid, not the customer-facing builder.
 * Normal shoppers always build a new bag from the live construction renderer.
 * Automated production visual QA can still mount Photo-True so the historical
 * reference contract remains testable without taking over the real configurator.
 */
export default function BagBuilderPhotoTrueGate({ children }: { children: ReactNode }) {
  const enabled = useSyncExternalStore(subscribe, readQaMode, () => false);
  if (!enabled) return null;
  return <>{children}</>;
}
