"use client";

import { useEffect, useState } from "react";
import BagBuilderPhotorealV19 from "./bag-builder-photoreal-v19";

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
  useEffect(() => {
    if (!ready) return;
    const style = () => {
      const stage = document.querySelector<HTMLElement>(SELECTOR);
      const canvas = document.querySelector<HTMLCanvasElement>(".abags-photoreal-v19-canvas");
      if (!stage || !canvas) return false;
      if (getComputedStyle(stage).position === "static") stage.style.position = "relative";
      canvas.style.position = "absolute";
      canvas.style.inset = "0";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.display = "block";
      canvas.style.zIndex = "90";
      canvas.style.touchAction = "none";
      canvas.style.pointerEvents = "auto";
      return true;
    };
    if (style()) return;
    const observer = new MutationObserver(style);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [ready]);
  return ready ? <BagBuilderPhotorealV19 /> : null;
}
