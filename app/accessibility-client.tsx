"use client";

import { useEffect } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getActiveModal(): HTMLElement | null {
  const layers = document.querySelectorAll<HTMLElement>(".modal-layer");
  const layer = layers.item(layers.length - 1);
  if (!layer) return null;
  return layer.querySelector<HTMLElement>("[role='dialog'][aria-modal='true']");
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !element.hasAttribute("disabled") &&
      element.getAttribute("aria-hidden") !== "true" &&
      element.getClientRects().length > 0,
  );
}

export default function AccessibilityClient() {
  useEffect(() => {
    let previousFocus: HTMLElement | null = null;
    let activeModal: HTMLElement | null = null;

    const syncModalFocus = () => {
      const nextModal = getActiveModal();
      if (nextModal === activeModal) return;

      if (!nextModal) {
        activeModal = null;
        const restoreTarget = previousFocus;
        previousFocus = null;
        queueMicrotask(() => restoreTarget?.focus({ preventScroll: true }));
        return;
      }

      if (!activeModal) {
        previousFocus =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;
      }

      activeModal = nextModal;
      queueMicrotask(() => {
        const target = getFocusableElements(nextModal)[0] ?? nextModal;
        if (target === nextModal && !target.hasAttribute("tabindex")) {
          target.setAttribute("tabindex", "-1");
        }
        target.focus({ preventScroll: true });
      });
    };

    const observer = new MutationObserver(syncModalFocus);
    observer.observe(document.body, { childList: true, subtree: true });
    syncModalFocus();

    const handleKeyDown = (event: KeyboardEvent) => {
      const modal = getActiveModal();
      if (!modal || event.key !== "Tab") return;

      const focusable = getFocusableElements(modal);
      if (focusable.length === 0) {
        event.preventDefault();
        modal.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;

      if (event.shiftKey && (current === first || !modal.contains(current))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const keepFocusInside = (event: FocusEvent) => {
      const modal = getActiveModal();
      if (!modal || modal.contains(event.target as Node)) return;
      const target = getFocusableElements(modal)[0] ?? modal;
      target.focus({ preventScroll: true });
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", keepFocusInside);

    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", keepFocusInside);
    };
  }, []);

  return null;
}
