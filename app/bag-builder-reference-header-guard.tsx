"use client";

import { useEffect } from "react";

const EYEBROW = "A-BAGS VISUAL CUSTOMIZER";
const TITLE = "Zbuduj swoją torebkę od podstaw";
const SUBTITLE = "Podgląd na żywo  •  Buduj warstwa po warstwie";

function syncHeader() {
  const dialog = document.querySelector<HTMLElement>(".abags-vc-dialog.abags-reference-layout-v3");
  if (!dialog) return false;
  const header = dialog.querySelector<HTMLElement>(".abags-vc-header");
  if (!header) return false;

  const eyebrow = header.querySelector<HTMLElement>(".eyebrow");
  const title = header.querySelector<HTMLElement>("h2");
  if (eyebrow && eyebrow.textContent !== EYEBROW) eyebrow.textContent = EYEBROW;
  if (title && title.textContent !== TITLE) title.textContent = TITLE;

  const copy = header.querySelector<HTMLElement>(":scope > div");
  if (copy) {
    let subtitle = copy.querySelector<HTMLElement>(".abags-v3-subtitle");
    if (!subtitle) {
      subtitle = document.createElement("p");
      subtitle.className = "abags-v3-subtitle";
      copy.appendChild(subtitle);
    }
    if (subtitle.textContent !== SUBTITLE) subtitle.textContent = SUBTITLE;
  }

  dialog.dataset.abagsV3HeaderLocked = "true";
  return true;
}

export default function BagBuilderReferenceHeaderGuard() {
  useEffect(() => {
    let frame = 0;
    const requestSync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        syncHeader();
      });
    };

    requestSync();
    const observer = new MutationObserver(requestSync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      document.querySelectorAll<HTMLElement>(".abags-vc-dialog[data-abags-v3-header-locked]").forEach((dialog) => {
        delete dialog.dataset.abagsV3HeaderLocked;
      });
    };
  }, []);

  return null;
}
