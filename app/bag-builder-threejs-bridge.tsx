"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BagBuilderThreeJsStage } from "./bag-builder-threejs-stage";

const STAGE_SELECTOR = ".abags-bag-builder-stage";
const OVERLAY_MARKER = "data-abags-threejs-overlay";

export default function BagBuilderThreeJsBridge() {
  const [mounts, setMounts] = useState<HTMLElement[]>([]);

  useEffect(() => {
    const reconcile = () => {
      const stages = Array.from(document.querySelectorAll<HTMLElement>(STAGE_SELECTOR));
      const next: HTMLElement[] = [];
      for (const stage of stages) {
        let mount = stage.querySelector<HTMLElement>(`[${OVERLAY_MARKER}]`);
        if (!mount) {
          mount = document.createElement("div");
          mount.setAttribute(OVERLAY_MARKER, "true");
          mount.className = "abags-threejs-overlay";
          stage.appendChild(mount);
        }
        next.push(mount);
      }
      setMounts((previous) => {
        if (previous.length === next.length && previous.every((item, index) => item === next[index])) return previous;
        return next;
      });
    };

    reconcile();
    const observer = new MutationObserver(reconcile);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return <>{mounts.map((mount) => createPortal(<BagBuilderThreeJsStage />, mount))}</>;
}
