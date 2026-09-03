"use client";

import { useEffect } from "react";

const MATERIAL_LABEL = "Sznurek poliestrowy";
const MATERIAL_SOURCE = "Pimiotki";
const MATERIAL_SENTENCE = `Materiał: ${MATERIAL_LABEL} (${MATERIAL_SOURCE}).`;

function addMaterialToWhatsappHref(href: string) {
  try {
    const url = new URL(href, window.location.origin);
    const text = url.searchParams.get("text");
    if (!text || text.includes(MATERIAL_SENTENCE)) return href;
    url.searchParams.set("text", `${text} ${MATERIAL_SENTENCE}`);
    return url.toString();
  } catch {
    return href;
  }
}

function addMaterialCard(controls: HTMLElement) {
  if (controls.querySelector("[data-builder-material='polyester-pimiotki']")) return;
  const heading = controls.querySelector(".abags-builder-heading");
  if (!heading) return;

  const card = document.createElement("div");
  card.className = "abags-builder-summary";
  card.dataset.builderMaterial = "polyester-pimiotki";
  card.setAttribute("role", "note");

  const top = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = "Materiał bazowy";
  const source = document.createElement("span");
  source.textContent = MATERIAL_SOURCE;
  top.append(title, source);

  const material = document.createElement("p");
  material.textContent = MATERIAL_LABEL;
  const note = document.createElement("small");
  note.textContent = "Kolor i splot dobierasz w kolejnych krokach kreatora.";

  card.append(top, material, note);
  heading.insertAdjacentElement("afterend", card);
}

function enrichBuilder() {
  const controls = document.querySelector<HTMLElement>(".abags-builder-controls");
  if (!controls) return;

  addMaterialCard(controls);

  const workshopLink = controls.querySelector<HTMLAnchorElement>(".abags-builder-actions a");
  const href = workshopLink?.getAttribute("href");
  if (!workshopLink || !href) return;

  const enrichedHref = addMaterialToWhatsappHref(href);
  if (enrichedHref !== href) workshopLink.setAttribute("href", enrichedHref);
}

export default function BagBuilderMaterialInfo() {
  useEffect(() => {
    enrichBuilder();
    const observer = new MutationObserver(enrichBuilder);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["href"],
    });

    return () => {
      observer.disconnect();
      document.querySelector("[data-builder-material='polyester-pimiotki']")?.remove();
    };
  }, []);

  return null;
}
