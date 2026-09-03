"use client";

import { useEffect } from "react";

const BASE = 82;
const MIN = 34;
const MAX = 145;

function clamp(value: number) {
  return Math.max(MIN, Math.min(MAX, Math.round(value)));
}

export default function BagBuilderCanvas3DTouchRescue() {
  useEffect(() => {
    const cleanups = new Map<HTMLElement, () => void>();

    const attach = (layer: HTMLElement) => {
      if (cleanups.has(layer)) return;
      const canvas = layer.querySelector<HTMLCanvasElement>(".abags-canvas3d-canvas");
      const controls = layer.querySelector<HTMLElement>(".abags-canvas3d-zoom");
      const range = controls?.querySelector<HTMLInputElement>('input[type="range"]');
      const minus = controls?.querySelector<HTMLButtonElement>('button[aria-label="Oddal model"]');
      const plus = controls?.querySelector<HTMLButtonElement>('button[aria-label="Przybliż model"]');
      const reset = controls?.querySelector<HTMLButtonElement>(".abags-canvas3d-reset");
      if (!canvas || !controls || !range || !minus || !plus || !reset) return;

      let percent = clamp(Number(range.value) || BASE);
      let lastControlAction = 0;
      const pointers = new Map<number, { x: number; y: number }>();
      let pinchStart: { distance: number; percent: number } | null = null;

      const distance = () => {
        const values = [...pointers.values()];
        return values.length < 2 ? 0 : Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
      };

      const apply = (next: number) => {
        percent = clamp(next);
        range.value = String(percent);
        range.setAttribute("aria-valuenow", String(percent));
        reset.textContent = `${percent}%`;
        canvas.style.transform = `scale(${percent / BASE})`;
        canvas.style.transformOrigin = "50% 50%";
        canvas.dataset.abagsTouchZoom = String(percent);
      };

      const consume = (event: Event) => {
        if (event.cancelable) event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
      };

      const makeControlHandler = (next: () => number) => (event: Event) => {
        const now = Date.now();
        consume(event);
        // A mobile tap can emit pointerup, touchend and click. Apply only once.
        if (now - lastControlAction < 180) return;
        lastControlAction = now;
        apply(next());
      };

      const onMinus = makeControlHandler(() => percent - 12);
      const onPlus = makeControlHandler(() => percent + 12);
      const onReset = makeControlHandler(() => BASE);
      const onRange = () => apply(Number(range.value));

      const bindControl = (button: HTMLButtonElement, handler: (event: Event) => void) => {
        button.addEventListener("pointerup", handler, true);
        button.addEventListener("touchend", handler, { capture: true, passive: false });
        button.addEventListener("click", handler, true);
        return () => {
          button.removeEventListener("pointerup", handler, true);
          button.removeEventListener("touchend", handler, true);
          button.removeEventListener("click", handler, true);
        };
      };

      const unbindMinus = bindControl(minus, onMinus);
      const unbindPlus = bindControl(plus, onPlus);
      const unbindReset = bindControl(reset, onReset);
      range.addEventListener("input", onRange, true);
      range.addEventListener("change", onRange, true);

      const onCanvasDown = (event: PointerEvent) => {
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.size >= 2) pinchStart = { distance: distance(), percent };
      };
      const onCanvasMove = (event: PointerEvent) => {
        if (!pointers.current && !pointers.has(event.pointerId)) return;
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.size >= 2 && pinchStart && pinchStart.distance > 0) {
          if (event.cancelable) event.preventDefault();
          apply(pinchStart.percent * (distance() / pinchStart.distance));
        }
      };
      const onCanvasEnd = (event: PointerEvent) => {
        pointers.delete(event.pointerId);
        if (pointers.size < 2) pinchStart = null;
      };
      canvas.addEventListener("pointerdown", onCanvasDown, true);
      canvas.addEventListener("pointermove", onCanvasMove, true);
      canvas.addEventListener("pointerup", onCanvasEnd, true);
      canvas.addEventListener("pointercancel", onCanvasEnd, true);

      apply(percent);
      cleanups.set(layer, () => {
        unbindMinus();
        unbindPlus();
        unbindReset();
        range.removeEventListener("input", onRange, true);
        range.removeEventListener("change", onRange, true);
        canvas.removeEventListener("pointerdown", onCanvasDown, true);
        canvas.removeEventListener("pointermove", onCanvasMove, true);
        canvas.removeEventListener("pointerup", onCanvasEnd, true);
        canvas.removeEventListener("pointercancel", onCanvasEnd, true);
        canvas.style.removeProperty("transform");
        canvas.style.removeProperty("transform-origin");
        delete canvas.dataset.abagsTouchZoom;
      });
    };

    const scan = () => {
      document.querySelectorAll<HTMLElement>(".abags-canvas3d-layer").forEach(attach);
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
