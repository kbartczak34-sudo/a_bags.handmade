"use client";

import { useEffect } from "react";

const FAR_MIN = 20;
const FAR_MAX = 128;
const FIT_ZOOM = 32;
const DEFAULT_ZOOM = 58;

function clamp(value: number) {
  return Math.max(FAR_MIN, Math.min(FAR_MAX, value));
}

function setReactRangeValue(input: HTMLInputElement, value: string) {
  const own = Object.getOwnPropertyDescriptor(input, "value")?.set;
  const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (proto && own !== proto) proto.call(input, value);
  else if (own) own.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function BagBuilderPro3DController() {
  useEffect(() => {
    const cleanups = new Map<HTMLElement, () => void>();

    const enhance = (layer: HTMLElement) => {
      if (layer.dataset.abagsPro3dController === "true") return;
      const canvas = layer.querySelector<HTMLCanvasElement>(".abags-pro3d-canvas");
      const nativeZoom = layer.querySelector<HTMLElement>(".abags-pro3d-zoom");
      const nativeRange = nativeZoom?.querySelector<HTMLInputElement>('input[type="range"]');
      const viewButtons = Array.from(layer.querySelectorAll<HTMLButtonElement>(".abags-pro3d-view-controls button"));
      const chip = layer.querySelector<HTMLElement>(".abags-pro3d-chip");
      if (!canvas || !nativeZoom || !nativeRange || viewButtons.length < 3) return;

      layer.dataset.abagsPro3dController = "true";
      layer.classList.add("abags-pro3d-v3");
      nativeZoom.hidden = true;
      canvas.style.touchAction = "none";
      if (chip) chip.textContent = "MODEL 3D · OBRÓT + ZOOM";

      const controls = document.createElement("div");
      controls.className = "abags-pro3d-v2-zoom";
      controls.setAttribute("aria-label", "Sterowanie modelem 3D");
      controls.innerHTML = `
        <button type="button" data-pro3d-fit>Cała torebka</button>
        <button type="button" data-pro3d-left aria-label="Obróć model w lewo">↶</button>
        <button type="button" data-pro3d-minus aria-label="Oddal model">−</button>
        <input type="range" min="${FAR_MIN}" max="${FAR_MAX}" step="1" value="${DEFAULT_ZOOM}" aria-label="Oddalenie modelu 3D" />
        <button type="button" data-pro3d-plus aria-label="Przybliż model">+</button>
        <button type="button" data-pro3d-right aria-label="Obróć model w prawo">↷</button>
        <output>${DEFAULT_ZOOM}%</output>
      `;
      layer.appendChild(controls);

      const range = controls.querySelector<HTMLInputElement>('input[type="range"]')!;
      const output = controls.querySelector<HTMLOutputElement>("output")!;
      const fit = controls.querySelector<HTMLButtonElement>("[data-pro3d-fit]")!;
      const minus = controls.querySelector<HTMLButtonElement>("[data-pro3d-minus]")!;
      const plus = controls.querySelector<HTMLButtonElement>("[data-pro3d-plus]")!;
      const left = controls.querySelector<HTMLButtonElement>("[data-pro3d-left]")!;
      const right = controls.querySelector<HTMLButtonElement>("[data-pro3d-right]")!;
      let zoom = DEFAULT_ZOOM;
      let activeView = 1;

      const fireNativeZoom = (percent: number) => {
        const nativePercent = Math.max(45, Math.min(128, Math.round(percent)));
        setReactRangeValue(nativeRange, String(nativePercent));
      };

      const apply = (value: number) => {
        zoom = clamp(value);
        range.value = String(Math.round(zoom));
        output.value = `${Math.round(zoom)}%`;
        output.textContent = `${Math.round(zoom)}%`;

        if (zoom < 45) {
          fireNativeZoom(45);
          canvas.style.setProperty("--abags-pro3d-fit-scale", String(zoom / 45));
        } else {
          fireNativeZoom(zoom);
          canvas.style.setProperty("--abags-pro3d-fit-scale", "1");
        }
      };

      const setActiveView = (index: number, trigger = false) => {
        activeView = Math.max(0, Math.min(2, index));
        viewButtons.forEach((button, buttonIndex) => {
          button.classList.toggle("is-active", buttonIndex === activeView);
          button.setAttribute("aria-pressed", buttonIndex === activeView ? "true" : "false");
        });
        layer.dataset.abagsPro3dView = activeView === 0 ? "front" : activeView === 2 ? "side" : "three";
        if (trigger) viewButtons[activeView]?.click();
      };

      const rotate = (direction: -1 | 1) => {
        const next = Math.max(0, Math.min(2, activeView + direction));
        if (next === activeView) setActiveView(direction > 0 ? 0 : 2, true);
        else setActiveView(next, true);
      };

      const viewListeners = viewButtons.map((button, index) => {
        const listener = () => setActiveView(index);
        button.addEventListener("click", listener);
        return () => button.removeEventListener("click", listener);
      });

      const onRange = () => apply(Number(range.value));
      const onFit = () => apply(FIT_ZOOM);
      const onMinus = () => apply(zoom - 8);
      const onPlus = () => apply(zoom + 8);
      const onLeft = () => rotate(-1);
      const onRight = () => rotate(1);
      range.addEventListener("input", onRange);
      fit.addEventListener("click", onFit);
      minus.addEventListener("click", onMinus);
      plus.addEventListener("click", onPlus);
      left.addEventListener("click", onLeft);
      right.addEventListener("click", onRight);

      const pointers = new Map<number, { x: number; y: number }>();
      let dragStart: { x: number; view: number } | null = null;
      let pinchStart: { distance: number; zoom: number } | null = null;

      const distance = () => {
        const points = Array.from(pointers.values());
        if (points.length < 2) return 0;
        return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      };

      const onPointerDown = (event: PointerEvent) => {
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.size === 1) dragStart = { x: event.clientX, view: activeView };
        if (pointers.size === 2) {
          pinchStart = { distance: distance(), zoom };
          dragStart = null;
        }
      };

      const onPointerMove = (event: PointerEvent) => {
        if (!pointers.has(event.pointerId)) return;
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.size >= 2 && pinchStart) {
          event.preventDefault();
          const nextDistance = distance();
          if (pinchStart.distance > 0) apply(pinchStart.zoom * (nextDistance / pinchStart.distance));
          return;
        }
        if (!dragStart) return;
        const dx = event.clientX - dragStart.x;
        if (Math.abs(dx) < 44) return;
        const step = dx > 0 ? -1 : 1;
        const next = Math.max(0, Math.min(2, dragStart.view + step));
        if (next !== activeView) setActiveView(next, true);
      };

      const onPointerEnd = (event: PointerEvent) => {
        pointers.delete(event.pointerId);
        if (pointers.size < 2) pinchStart = null;
        if (pointers.size === 0) dragStart = null;
      };

      canvas.addEventListener("pointerdown", onPointerDown, { capture: true });
      canvas.addEventListener("pointermove", onPointerMove, { capture: true });
      canvas.addEventListener("pointerup", onPointerEnd, { capture: true });
      canvas.addEventListener("pointercancel", onPointerEnd, { capture: true });

      const blockTouchScroll = (event: TouchEvent) => event.preventDefault();
      canvas.addEventListener("touchmove", blockTouchScroll, { passive: false });

      requestAnimationFrame(() => {
        setActiveView(1, true);
        apply(DEFAULT_ZOOM);
      });

      cleanups.set(layer, () => {
        viewListeners.forEach((cleanup) => cleanup());
        range.removeEventListener("input", onRange);
        fit.removeEventListener("click", onFit);
        minus.removeEventListener("click", onMinus);
        plus.removeEventListener("click", onPlus);
        left.removeEventListener("click", onLeft);
        right.removeEventListener("click", onRight);
        canvas.removeEventListener("pointerdown", onPointerDown, { capture: true });
        canvas.removeEventListener("pointermove", onPointerMove, { capture: true });
        canvas.removeEventListener("pointerup", onPointerEnd, { capture: true });
        canvas.removeEventListener("pointercancel", onPointerEnd, { capture: true });
        canvas.removeEventListener("touchmove", blockTouchScroll);
        controls.remove();
        nativeZoom.hidden = false;
        canvas.style.removeProperty("--abags-pro3d-fit-scale");
        canvas.style.removeProperty("touch-action");
        layer.classList.remove("abags-pro3d-v3");
        delete layer.dataset.abagsPro3dController;
        delete layer.dataset.abagsPro3dView;
      });
    };

    const scan = () => {
      document.querySelectorAll<HTMLElement>(".abags-pro3d-layer").forEach(enhance);
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
