"use client";

import { useEffect } from "react";

const MIN_SCALE = 0.45;
const MAX_SCALE = 1.15;
const DEFAULT_SCALE = 0.82;

function clamp(value: number) {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, value));
}

function distance(points: Array<{ x: number; y: number }>) {
  if (points.length < 2) return 0;
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

export default function BagBuilder3DEnhancer() {
  useEffect(() => {
    const cleanups = new Map<HTMLElement, () => void>();

    const enhance = (layer: HTMLElement) => {
      if (layer.dataset.abags3dEnhanced === "true") return;
      const canvas = layer.querySelector<HTMLCanvasElement>(".abags-real3d-canvas");
      const controls = layer.querySelector<HTMLElement>(".abags-real3d-controls");
      const chip = layer.querySelector<HTMLElement>(".abags-real3d-chip");
      if (!canvas || !controls) return;

      layer.dataset.abags3dEnhanced = "true";
      layer.style.setProperty("--abags-extra-scale", String(DEFAULT_SCALE));
      if (chip) chip.textContent = "MODEL 3D · OBRÓĆ 360° · PINCH ZOOM";

      const viewButtons = Array.from(controls.querySelectorAll<HTMLButtonElement>("button")).slice(0, 3);
      const setActiveView = (index: number) => {
        viewButtons.forEach((button, buttonIndex) => {
          button.classList.toggle("is-active", buttonIndex === index);
          button.setAttribute("aria-pressed", buttonIndex === index ? "true" : "false");
        });
      };

      const viewListeners = viewButtons.map((button, index) => {
        const listener = () => setActiveView(index);
        button.addEventListener("click", listener);
        return () => button.removeEventListener("click", listener);
      });

      const zoomPanel = document.createElement("div");
      zoomPanel.className = "abags-real3d-extended-zoom";
      zoomPanel.setAttribute("aria-label", "Sterowanie oddaleniem modelu 3D");
      zoomPanel.innerHTML = `
        <span class="abags-real3d-zoom-label">ODDAL / PRZYBLIŻ</span>
        <button type="button" data-abags-zoom-out aria-label="Oddal model">−</button>
        <input data-abags-zoom-range type="range" min="45" max="115" step="1" value="82" aria-label="Oddalenie modelu 3D" />
        <button type="button" data-abags-zoom-in aria-label="Przybliż model">+</button>
        <button type="button" data-abags-zoom-reset aria-label="Przywróć domyślne oddalenie">82%</button>
      `;
      layer.appendChild(zoomPanel);

      const range = zoomPanel.querySelector<HTMLInputElement>("[data-abags-zoom-range]")!;
      const reset = zoomPanel.querySelector<HTMLButtonElement>("[data-abags-zoom-reset]")!;
      let scale = DEFAULT_SCALE;

      const applyScale = (next: number) => {
        scale = clamp(next);
        layer.style.setProperty("--abags-extra-scale", scale.toFixed(3));
        range.value = String(Math.round(scale * 100));
        reset.textContent = `${Math.round(scale * 100)}%`;
      };

      const zoomOut = () => applyScale(scale - 0.1);
      const zoomIn = () => applyScale(scale + 0.1);
      const zoomReset = () => applyScale(DEFAULT_SCALE);
      const zoomRange = () => applyScale(Number(range.value) / 100);

      zoomPanel.querySelector<HTMLButtonElement>("[data-abags-zoom-out]")!.addEventListener("click", zoomOut);
      zoomPanel.querySelector<HTMLButtonElement>("[data-abags-zoom-in]")!.addEventListener("click", zoomIn);
      reset.addEventListener("click", zoomReset);
      range.addEventListener("input", zoomRange);

      const pointers = new Map<number, { x: number; y: number }>();
      let pinchStarted = false;
      let pinchDistance = 0;
      let pinchScale = scale;

      const pointerDown = (event: PointerEvent) => {
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.size >= 2) {
          pinchStarted = true;
          pinchDistance = distance(Array.from(pointers.values()).slice(0, 2));
          pinchScale = scale;
          event.preventDefault();
          event.stopPropagation();
        }
      };

      const pointerMove = (event: PointerEvent) => {
        if (!pointers.has(event.pointerId)) return;
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (!pinchStarted || pointers.size < 2) return;
        const nextDistance = distance(Array.from(pointers.values()).slice(0, 2));
        if (pinchDistance > 0) applyScale(pinchScale * (nextDistance / pinchDistance));
        event.preventDefault();
        event.stopPropagation();
      };

      const pointerEnd = (event: PointerEvent) => {
        if (pinchStarted) {
          event.preventDefault();
          event.stopPropagation();
        }
        pointers.delete(event.pointerId);
        if (pointers.size === 0) {
          pinchStarted = false;
          pinchDistance = 0;
        }
      };

      canvas.addEventListener("pointerdown", pointerDown, true);
      canvas.addEventListener("pointermove", pointerMove, true);
      canvas.addEventListener("pointerup", pointerEnd, true);
      canvas.addEventListener("pointercancel", pointerEnd, true);

      // Open the builder in a clearly oblique view instead of a nearly-flat front view.
      requestAnimationFrame(() => {
        viewButtons[1]?.click();
        setActiveView(1);
      });

      cleanups.set(layer, () => {
        viewListeners.forEach((cleanup) => cleanup());
        canvas.removeEventListener("pointerdown", pointerDown, true);
        canvas.removeEventListener("pointermove", pointerMove, true);
        canvas.removeEventListener("pointerup", pointerEnd, true);
        canvas.removeEventListener("pointercancel", pointerEnd, true);
        zoomPanel.remove();
        layer.style.removeProperty("--abags-extra-scale");
        delete layer.dataset.abags3dEnhanced;
      });
    };

    const scan = () => {
      document.querySelectorAll<HTMLElement>(".abags-real3d-layer").forEach(enhance);
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
