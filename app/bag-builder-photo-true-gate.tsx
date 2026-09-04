"use client";

import { useSyncExternalStore, type ReactNode } from "react";

function subscribe() {
  return () => {};
}

function readQaMode() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("photoTrueQa") === "1" || params.has("abags-photo-true-v5") || params.has("abags-photo-mobile");
}

/**
 * Photo-True is a reference/QA aid, not the customer-facing builder.
 * Normal shoppers and ordinary automated browsers always use the realtime
 * construction renderer. The photographic reference mode is enabled only by
 * an explicit internal QA query flag.
 */
export default function BagBuilderPhotoTrueGate({ children }: { children: ReactNode }) {
  const enabled = useSyncExternalStore(subscribe, readQaMode, () => false);
  if (!enabled) return null;
  return <>{children}</>;
}
