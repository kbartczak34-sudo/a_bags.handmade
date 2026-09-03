"use client";

import { useEffect } from "react";

export default function BagBuilderPro3DTouchRescue() {
  useEffect(() => {
    const cleanups = new Map<HTMLElement, () => void>();

    const attach = (layer: HTMLElement) => {
      if (cleanups.has(layer)) return;
      const controls = Array.from(
        layer.querySelectorAll<HTMLButtonElement>(".abags-pro3d-view-controls button, .abags-pro3d-zoom button"),
      );
      const canvas = layer.querySelector<HTMLCanvasElement>(".abags-pro3d-canvas");
      if (!canvas || !controls.length) return;

      canvas.style.touchAction = "none";
      const removers: Array<() => void> = [];

      for (const button of controls) {
        let lastTouchActivation = 0;
        let programmaticActivation = false;

        const activate = (event: Event) => {
          const pointer = event as PointerEvent;
          if (event.type === "pointerup" && pointer.pointerType && pointer.pointerType !== "touch") return;
          const now = Date.now();
          if (now - lastTouchActivation < 220) return;
          lastTouchActivation = now;
          if (event.cancelable) event.preventDefault();
          event.stopPropagation();
          programmaticActivation = true;
          button.click();
          programmaticActivation = false;
        };

        const suppressDuplicateClick = (event: MouseEvent) => {
          if (programmaticActivation || event.detail === 0) return;
          if (Date.now() - lastTouchActivation > 350) return;
          if (event.cancelable) event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
        };

        const onTouchEnd = (event: TouchEvent) => {
          if ("PointerEvent" in window) return;
          activate(event);
        };

        button.addEventListener("pointerup", activate, true);
        button.addEventListener("touchend", onTouchEnd, { capture: true, passive: false });
        button.addEventListener("click", suppressDuplicateClick, true);
        removers.push(() => {
          button.removeEventListener("pointerup", activate, true);
          button.removeEventListener("touchend", onTouchEnd, true);
          button.removeEventListener("click", suppressDuplicateClick, true);
        });
      }

      cleanups.set(layer, () => {
        removers.forEach((remove) => remove());
        canvas.style.removeProperty("touch-action");
      });
    };

    const scan = () => {
      document.querySelectorAll<HTMLElement>(".abags-pro3d-layer").forEach(attach);
      for (const [layer, cleanup] of cleanups) {
        if (!document.body.contains(layer)) {
          cleanup();
          cleanups.delete(layer);
        }
      }
    };

    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      cleanups.forEach((cleanup) => cleanup());
      cleanups.clear();
    };
  }, []);

  return null;
}
