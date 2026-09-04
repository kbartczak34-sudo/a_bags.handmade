"use client";

import { useEffect } from "react";

const DIALOG_SELECTOR = ".abags-vc-dialog.abags-reference-layout-v4";
const CLOSE_SELECTOR = '.abags-vc-header > button[aria-label="Zamknij"]:not(.abags-v4-header-tool)';
const MARKED_CLOSE_SELECTOR = 'button[data-abags-customer-close-icon="svg"]';
const SVG_SELECTOR = "svg[data-abags-customer-close-svg]";

function createCloseSvg() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.dataset.abagsCustomerCloseSvg = "true";

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M6 6l12 12M18 6L6 18");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.8");
  path.setAttribute("stroke-linecap", "round");
  svg.appendChild(path);
  return svg;
}

function restoreClose(button: HTMLButtonElement) {
  button.querySelector(SVG_SELECTOR)?.remove();
  delete button.dataset.abagsCustomerCloseIcon;
}

function installClose(button: HTMLButtonElement) {
  if (!button.querySelector(SVG_SELECTOR)) button.appendChild(createCloseSvg());
  button.dataset.abagsCustomerCloseIcon = "svg";
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
