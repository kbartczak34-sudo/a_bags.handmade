"use client";

import { useSyncExternalStore, type ReactNode } from "react";

function subscribe() {
  return () => {};
}

function readQaMode() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("photoTrueQa") === "1";
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
