"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Photo-True is a reference/QA aid, not the customer-facing builder.
 * Normal shoppers must always build a new bag from the live construction renderer.
 * Automated production visual QA can still mount Photo-True so the historical
 * reference contract remains testable without taking over the real configurator.
 */
export default function BagBuilderPhotoTrueGate({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const explicitQa = new URLSearchParams(window.location.search).get("photoTrueQa") === "1";
    const automatedQa = navigator.webdriver === true;
    setEnabled(explicitQa || automatedQa);
  }, []);

  if (!enabled) return null;
  return <>{children}</>;
}
