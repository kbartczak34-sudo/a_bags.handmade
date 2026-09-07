"use client";

import { type ReactNode } from "react";

/**
 * The photographic layer is now part of the customer experience. The
 * BagBuilderPhotoTrueExactOnly guard is the authority that decides whether a
 * selected reference may be shown as PHOTO-TRUE 1:1; unsupported/customized
 * states immediately fall back to the realtime construction renderer.
 */
export default function BagBuilderPhotoTrueGate({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
