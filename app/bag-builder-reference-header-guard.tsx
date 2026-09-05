"use client";

import { useEffect } from "react";

const EYEBROW = "A-BAGS VISUAL CUSTOMIZER";
const TITLE = "Zbuduj swoją torebkę od podstaw";
const SUBTITLE = "Podgląd na żywo  •  Buduj warstwa po warstwie";
const OWNER_MARK_SRC = "/abags-owner-mark.svg";
const OWNER_MARK_ALT = "a_bags Handmade";

function ownEyebrow(header: HTMLElement) {
  const legacy = header.querySelector<HTMLElement>(".eyebrow");
  const current = header.querySelector<HTMLElement>(".abags-v3-eyebrow") ?? legacy;
  if (!current) return false;

  // BagBuilderEngine writes to `.abags-vc-header .eyebrow` on every sync.
  // Once Reference Layout V3 owns the header, remove that legacy selector so
  // the engine can no longer overwrite approved V3 copy.
  if (current.classList.contains("eyebrow")) current.classList.remove("eyebrow");
  current.classList.add("abags-v3-eyebrow");
  if (current.textContent !== EYEBROW) current.textContent = EYEBROW;
  return true;
}

function ownTitle(header: HTMLElement) {
  let current = header.querySelector<HTMLElement>(".abags-v3-title");
  const legacy = header.querySelector<HTMLHeadingElement>("h2");

  // BagBuilderEngine also writes directly to `.abags-vc-header h2`.
  // Replace the legacy h2 with an equivalent accessible heading that keeps
  // the aria-labelledby id but is outside the engine's ownership selector.
  if (!current && legacy) {
    const replacement = document.createElement("div");
    replacement.className = "abags-v3-title";
    replacement.id = legacy.id || "abags-vc-title";
    replacement.setAttribute("role", "heading");
    replacement.setAttribute("aria-level", "2");
    replacement.textContent = TITLE;
    legacy.replaceWith(replacement);
    current = replacement;
  } else if (legacy && current) {
    legacy.remove();
  }

  if (!current) return false;
  if (!current.id) current.id = "abags-vc-title";
  current.setAttribute("role", "heading");
  current.setAttribute("aria-level", "2");
  if (current.textContent !== TITLE) current.textContent = TITLE;
  return true;
}

function ownWordmark(header: HTMLElement) {
  const current = header.querySelector<HTMLElement>(".abags-v3-wordmark");

  if (current instanceof HTMLImageElement) {
    if (current.getAttribute("src") !== OWNER_MARK_SRC) current.src = OWNER_MARK_SRC;
    if (current.alt !== OWNER_MARK_ALT) current.alt = OWNER_MARK_ALT;
    if (current.width !== 104) current.width = 104;
    if (current.height !== 43) current.height = 43;
    current.decoding = "async";
    current.draggable = false;
    return true;
  }

  const mark = document.createElement("img");
  mark.className = "abags-v3-wordmark";
  mark.src = OWNER_MARK_SRC;
  mark.alt = OWNER_MARK_ALT;
  mark.width = 104;
  mark.height = 43;
  mark.decoding = "async";
  mark.draggable = false;

  if (current) current.replaceWith(mark);
  else header.appendChild(mark);
  return true;
}

function syncHeader() {
  const dialog = document.querySelector<HTMLElement>(".abags-vc-dialog.abags-reference-layout-v3");
  if (!dialog) return false;
  const header = dialog.querySelector<HTMLElement>(".abags-vc-header");
  if (!header) return false;

  const eyebrowOwned = ownEyebrow(header);
  const titleOwned = ownTitle(header);
  const wordmarkOwned = ownWordmark(header);

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

  if (eyebrowOwned && titleOwned && wordmarkOwned) {
    dialog.dataset.abagsV3HeaderLocked = "true";
  }
  return eyebrowOwned && titleOwned && wordmarkOwned;
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
