"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BagBuilderThreeJsStage } from "./bag-builder-threejs-stage";

const STAGE_SELECTOR = ".abags-bag-builder-stage";
const OVERLAY_MARKER = "data-abags-threejs-overlay";

type AssetManifest = {
  version: number;
  models: Record<string, { glb: string }>;
};

type Mount = { element: HTMLElement; modelId: string };

export default function BagBuilderThreeJsBridge() {
  const [mounts, setMounts] = useState<Mount[]>([]);

  useEffect(() => {
    let active = true;
    let manifest: AssetManifest = { version: 1, models: {} };

    const reconcile = () => {
      const stages = Array.from(document.querySelectorAll<HTMLElement>(STAGE_SELECTOR));
      const next: Mount[] = [];
      for (const stage of stages) {
        const modelId = (stage.dataset.photoProductId || stage.dataset.family || "").trim();
        if (!modelId || !manifest.models[modelId]?.glb) continue;
        let mount = stage.querySelector<HTMLElement>(`[${OVERLAY_MARKER}]`);
        if (!mount) {
          mount = document.createElement("div");
          mount.setAttribute(OVERLAY_MARKER, "true");
          mount.className = "abags-threejs-overlay";
          stage.appendChild(mount);
        }
        next.push({ element: mount, modelId });
      }
      setMounts((previous) => {
        if (previous.length === next.length && previous.every((item, index) => item.element === next[index].element && item.modelId === next[index].modelId)) return previous;
        return next;
      });
    };

    fetch("/3d/bags/manifest.json", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("manifest-unavailable");
        return (await response.json()) as AssetManifest;
      })
      .then((loaded) => {
        if (!active || loaded?.version !== 1 || !loaded.models || typeof loaded.models !== "object") return;
        manifest = loaded;
        reconcile();
      })
      .catch(() => {
        if (active) setMounts([]);
      });

    reconcile();
    const observer = new MutationObserver(reconcile);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-family", "data-photo-product-id"] });
    return () => {
      active = false;
      observer.disconnect();
    };
  }, []);

  return <>{mounts.map(({ element, modelId }) => createPortal(<BagBuilderThreeJsStage modelId={modelId} />, element, `${modelId}:${String(mounts.indexOf(mounts.find((item) => item.element === element)))}`))}</>;
}
