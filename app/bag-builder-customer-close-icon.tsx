"use client";

import { useEffect } from "react";

const DIALOG_SELECTOR = ".abags-vc-dialog.abags-reference-layout-v4";
const CLOSE_SELECTOR = '.abags-vc-header > button[aria-label="Zamknij"]:not(.abags-v4-header-tool)';
const MARKED_CLOSE_SELECTOR = 'button[data-abags-customer-close-icon="lines-v2"]';
const SURFACE_SELECTOR = '[data-abags-customer-close-surface="true"]';
const BUTTON_PROPERTIES = [
  "display",
  "place-items",
  "font-size",
  "line-height",
  "color",
  "background-color",
  "background-image",
  "overflow",
] as const;

type SavedStyle = Record<(typeof BUTTON_PROPERTIES)[number], { value: string; priority: string }>;

const savedStyles = new WeakMap<HTMLButtonElement, SavedStyle>();

function rememberStyles(button: HTMLButtonElement) {
  if (savedStyles.has(button)) return;
  const state = {} as SavedStyle;
  for (const property of BUTTON_PROPERTIES) {
    state[property] = {
      value: button.style.getPropertyValue(property),
      priority: button.style.getPropertyPriority(property),
    };
  }
  savedStyles.set(button, state);
}

function setImportant(element: HTMLElement, property: string, value: string) {
  element.style.setProperty(property, value, "important");
}

function createStroke(angle: string) {
  const line = document.createElement("span");
  line.setAttribute("aria-hidden", "true");
  setImportant(line, "position", "absolute");
  setImportant(line, "left", "50%");
  setImportant(line, "top", "50%");
  setImportant(line, "width", "17px");
  setImportant(line, "height", "1.8px");
  setImportant(line, "border-radius", "999px");
  setImportant(line, "background", "#674d53");
  setImportant(line, "transform", `translate(-50%, -50%) rotate(${angle})`);
  setImportant(line, "transform-origin", "center");
  setImportant(line, "pointer-events", "none");
  return line;
}

function createCloseSurface() {
  const surface = document.createElement("span");
  surface.dataset.abagsCustomerCloseSurface = "true";
  surface.setAttribute("aria-hidden", "true");
  setImportant(surface, "position", "relative");
  setImportant(surface, "display", "block");
  setImportant(surface, "width", "18px");
  setImportant(surface, "height", "18px");
  setImportant(surface, "margin", "0");
  setImportant(surface, "padding", "0");
  setImportant(surface, "pointer-events", "none");
  surface.append(createStroke("45deg"), createStroke("-45deg"));
  return surface;
}

function restoreClose(button: HTMLButtonElement) {
  button.querySelector(SURFACE_SELECTOR)?.remove();
  const previous = savedStyles.get(button);
  if (previous) {
    for (const property of BUTTON_PROPERTIES) {
      const state = previous[property];
      if (state.value) button.style.setProperty(property, state.value, state.priority);
      else button.style.removeProperty(property);
    }
    savedStyles.delete(button);
  }
  delete button.dataset.abagsCustomerCloseIcon;
}

function installClose(button: HTMLButtonElement) {
  rememberStyles(button);
  if (!button.querySelector(SURFACE_SELECTOR)) button.appendChild(createCloseSurface());
  button.dataset.abagsCustomerCloseIcon = "lines-v2";
  setImportant(button, "display", "grid");
  setImportant(button, "place-items", "center");
  setImportant(button, "font-size", "0");
  setImportant(button, "line-height", "0");
  setImportant(button, "color", "transparent");
  setImportant(button, "background-color", "#fff");
  setImportant(button, "background-image", "none");
  setImportant(button, "overflow", "hidden");
}

export default function BagBuilderCustomerCloseIcon() {
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 981px)");
    let frame = 0;

    const sync = () => {
      frame = 0;
      const activeDialogs = new Set<HTMLElement>();

      document.querySelectorAll<HTMLElement>(DIALOG_SELECTOR).forEach((dialog) => {
        activeDialogs.add(dialog);
        const button = dialog.querySelector<HTMLButtonElement>(CLOSE_SELECTOR);
        if (!button) return;
        const customerDesktop = desktop.matches && dialog.dataset.abagsPhotoTrue !== "active";
        if (customerDesktop) installClose(button);
        else restoreClose(button);
      });

      document.querySelectorAll<HTMLButtonElement>(MARKED_CLOSE_SELECTOR).forEach((button) => {
        const dialog = button.closest<HTMLElement>(DIALOG_SELECTOR);
        if (!dialog || !activeDialogs.has(dialog) || !desktop.matches || dialog.dataset.abagsPhotoTrue === "active") restoreClose(button);
      });
    };

    const requestSync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(sync);
    };

    requestSync();
    const observer = new MutationObserver(requestSync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "data-abags-photo-true"],
    });
    desktop.addEventListener?.("change", requestSync);

    return () => {
      observer.disconnect();
      desktop.removeEventListener?.("change", requestSync);
      if (frame) window.cancelAnimationFrame(frame);
      document.querySelectorAll<HTMLButtonElement>(MARKED_CLOSE_SELECTOR).forEach(restoreClose);
    };
  }, []);

  return null;
}
