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
      const pointers = new Map<number, { x: number; y: number }>();
      let pinchStart: { distance: number; percent: number } | null = null;

      const distance = () => {
        const values = [...pointers.values()];
        return values.length < 2 ? 0 : Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
      };

      const apply = (next: number) => {
        percent = clamp(next);
        range.value = String(percent);
        reset.textContent = `${percent}%`;
        canvas.style.transform = `scale(${percent / BASE})`;
        canvas.style.transformOrigin = "50% 50%";
        canvas.dataset.abagsTouchZoom = String(percent);
      };

      const consume = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        if ("stopImmediatePropagation" in event) event.stopImmediatePropagation();
      };

      const onMinusPointer = (event: PointerEvent) => { consume(event); apply(percent - 12); };
      const onPlusPointer = (event: PointerEvent) => { consume(event); apply(percent + 12); };
      const onResetPointer = (event: PointerEvent) => { consume(event); apply(BASE); };
      const onBlockedClick = (event: MouseEvent) => consume(event);
      const onRange = () => apply(Number(range.value));

      minus.addEventListener("pointerup", onMinusPointer, true);
      plus.addEventListener("pointerup", onPlusPointer, true);
      reset.addEventListener("pointerup", onResetPointer, true);
      minus.addEventListener("click", onBlockedClick, true);
      plus.addEventListener("click", onBlockedClick, true);
      reset.addEventListener("click", onBlockedClick, true);
      range.addEventListener("input", onRange, true);

      const onCanvasDown = (event: PointerEvent) => {
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.size >= 2) pinchStart = { distance: distance(), percent };
      };
      const onCanvasMove = (event: PointerEvent) => {
        if (!pointers.has(event.pointerId)) return;
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.size >= 2 && pinchStart && pinchStart.distance > 0) {
          event.preventDefault();
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
        minus.removeEventListener("pointerup", onMinusPointer, true);
        plus.removeEventListener("pointerup", onPlusPointer, true);
        reset.removeEventListener("pointerup", onResetPointer, true);
        minus.removeEventListener("click", onBlockedClick, true);
        plus.removeEventListener("click", onBlockedClick, true);
        reset.removeEventListener("click", onBlockedClick, true);
        range.removeEventListener("input", onRange, true);
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
