"use client";

import { useLayoutEffect } from "react";

const migrations = [
  ["abags-pro3d-view-controls", "abags-fidelity3d-view-controls"],
  ["abags-pro3d-zoom", "abags-fidelity3d-zoom"],
] as const;

function migrate(root: ParentNode = document) {
  for (const [legacyClass, fidelityClass] of migrations) {
    root.querySelectorAll<HTMLElement>(`.abags-fidelity3d-layer .${legacyClass}`).forEach((element) => {
      element.classList.remove(legacyClass);
      element.classList.add(fidelityClass);
    });
  }
}

export default function BagBuilderFidelity3DControlNamespace() {
  useLayoutEffect(() => {
    migrate();

    const observer = new MutationObserver((records) => {
      let shouldMigrate = false;
      for (const record of records) {
        if (record.type === "childList" && record.addedNodes.length) {
          shouldMigrate = true;
          break;
        }
        if (record.type === "attributes" && record.attributeName === "class") {
          const target = record.target;
          if (target instanceof HTMLElement && target.closest(".abags-fidelity3d-layer")) {
            shouldMigrate = true;
            break;
          }
        }
      }
      if (shouldMigrate) migrate();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
