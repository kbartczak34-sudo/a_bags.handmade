"use client";

import { useEffect, useState } from "react";
import BagBuilderPhotorealV18 from "./bag-builder-photoreal-v18";

const SELECTOR = ".abags-vc-dialog.abags-vc-builder-active .abags-bag-builder-stage";

export default function BagBuilderPhotorealV17Mount() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const check = () => setReady(Boolean(document.querySelector(SELECTOR)));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "data-family", "data-color", "data-stitch", "data-flap", "data-handles", "data-strap", "data-hardware", "data-accent"] });
    return () => observer.disconnect();
  }, []);
  return ready ? <BagBuilderPhotorealV18 /> : null;
}
