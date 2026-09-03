"use client";

import { useEffect } from "react";

const FAR_MIN = 20;
const FAR_MAX = 128;
const FIT_ZOOM = 32;
const DEFAULT_ZOOM = 58;

function clamp(value: number) {
  return Math.max(FAR_MIN, Math.min(FAR_MAX, value));
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
      if (!canvas || !nativeZoom || !nativeRange || viewButtons.length < 3) return;

      layer.dataset.abagsPro3dController = "true";
      layer.classList.add("abags-pro3d-v2");
      nativeZoom.hidden = true;

      const controls = document.createElement("div");
      controls.className = "abags-pro3d-v2-zoom";
      controls.setAttribute("aria-label", "Oddalanie i dopasowanie modelu 3D");
      controls.innerHTML = `
        <button type="button" data-pro3d-fit>Cała torebka</button>
        <button type="button" data-pro3d-minus aria-label="Oddal model">−</button>
        <input type="range" min="${FAR_MIN}" max="${FAR_MAX}" step="1" value="${DEFAULT_ZOOM}" aria-label="Oddalenie modelu 3D" />
        <button type="button" data-pro3d-plus aria-label="Przybliż model">+</button>
        <output>${DEFAULT_ZOOM}%</output>
      `;
      layer.appendChild(controls);

      const range = controls.querySelector<HTMLInputElement>('input[type="range"]')!;
      const output = controls.querySelector<HTMLOutputElement>("output")!;
      const fit = controls.querySelector<HTMLButtonElement>("[data-pro3d-fit]")!;
      const minus = controls.querySelector<HTMLButtonElement>("[data-pro3d-minus]")!;
      const plus = controls.querySelector<HTMLButtonElement>("[data-pro3d-plus]")!;
      let zoom = DEFAULT_ZOOM;

      const fireNativeZoom = (percent: number) => {
        nativeRange.value = String(Math.max(45, Math.min(128, Math.round(percent))));
        nativeRange.dispatchEvent(new Event("input", { bubbles: true }));
        nativeRange.dispatchEvent(new Event("change", { bubbles: true }));
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

      const setActiveView = (index: number) => {
        viewButtons.forEach((button, buttonIndex) => {
          button.classList.toggle("is-active", buttonIndex === index);
          button.setAttribute("aria-pressed", buttonIndex === index ? "true" : "false");
        });
        layer.dataset.abagsPro3dView = index === 0 ? "front" : index === 2 ? "side" : "three";
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
      range.addEventListener("input", onRange);
      fit.addEventListener("click", onFit);
      minus.addEventListener("click", onMinus);
      plus.addEventListener("click", onPlus);

      requestAnimationFrame(() => {
        viewButtons[1]?.click();
        setActiveView(1);
        apply(DEFAULT_ZOOM);
      });

      cleanups.set(layer, () => {
        viewListeners.forEach((cleanup) => cleanup());
        range.removeEventListener("input", onRange);
        fit.removeEventListener("click", onFit);
        minus.removeEventListener("click", onMinus);
        plus.removeEventListener("click", onPlus);
        controls.remove();
        nativeZoom.hidden = false;
        canvas.style.removeProperty("--abags-pro3d-fit-scale");
        layer.classList.remove("abags-pro3d-v2");
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
