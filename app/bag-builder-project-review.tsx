"use client";

import { useEffect } from "react";

type BuilderConfig = {
  family: string;
  color: string;
  stitch: string;
  flap: string;
  handles: string;
  strap: string;
  hardware: string;
  accent: string;
};

type PhotoIdentity = {
  active: boolean;
  productId: string;
  productName: string;
};

const MATERIAL = "Sznurek poliestrowy · Pimiotki";

const FAMILY_LABELS: Record<string, string> = {
  tote: "Kuferek / tote",
  round: "Okrągła",
  bucket: "Z klapą",
  mini: "Strukturalna / mini",
};

const COLOR_LABELS: Record<string, string> = {
  "#E8DDCC": "Naturalny beż",
  "#E4A9B5": "Pudrowy róż",
  "#24324D": "Głęboki granat",
  "#65493D": "Czekoladowy brąz",
  "#C7962F": "Musztardowy",
  "#222124": "Czarny",
  "#B93A42": "Czerwony",
  "#275C4A": "Butelkowa zieleń",
  "#087E81": "Turkus",
  "#A88AE0": "Lawendowy",
};

const STITCH_LABELS: Record<string, string> = {
  classic: "Ażurowy V",
  herringbone: "Pionowy ażurowy",
  basket: "Koszykowy",
  shell: "Promienisty",
};

const FLAP_LABELS: Record<string, string> = {
  none: "Bez klapy",
  crochet: "Szydełkowa",
  "leather-black": "Skórzana czarna",
  "leather-cognac": "Skórzana koniak",
  "suede-burgundy": "Zamszowa bordo",
};

const HANDLE_LABELS: Record<string, string> = {
  none: "Bez uchwytu",
  "wood-light": "Drewno jasne",
  "wood-dark": "Drewno ciemne",
  crochet: "Uchwyt szydełkowy",
};

const STRAP_LABELS: Record<string, string> = {
  none: "Bez paska",
  leather: "Pasek skórzany",
  woven: "Pasek tkany",
  chain: "Łańcuszek",
};

const HARDWARE_LABELS: Record<string, string> = {
  gold: "Złote",
  silver: "Srebrne",
  black: "Czarne",
};

const ACCENT_LABELS: Record<string, string> = {
  none: "Bez ozdoby",
  tassel: "Chwost",
  scarf: "Apaszka / kokarda",
  charm: "Zawieszka",
};

function readConfig(stage: HTMLElement): BuilderConfig {
  return {
    family: stage.dataset.family || "",
    color: stage.dataset.color || "",
    stitch: stage.dataset.stitch || "",
    flap: stage.dataset.flap || "none",
    handles: stage.dataset.handles || "none",
    strap: stage.dataset.strap || "none",
    hardware: stage.dataset.hardware || "gold",
    accent: stage.dataset.accent || "none",
  };
}

function readPhotoIdentity(stage: HTMLElement): PhotoIdentity {
  const productId = stage.dataset.photoProductId || "";
  const productName = stage.dataset.photoProductName || "";
  return {
    active: stage.dataset.abagsPhotoTrue === "active" && Boolean(productId),
    productId,
    productName,
  };
}

function label(map: Record<string, string>, value: string, fallback = "Nie wybrano") {
  return map[value] || fallback;
}

function projectCode(config: BuilderConfig, photo: PhotoIdentity) {
  const legacySignature = Object.values(config).join("|");
  const signature = photo.active ? `${photo.productId}|${legacySignature}` : legacySignature;
  let hash = 2166136261;
  for (let index = 0; index < signature.length; index += 1) {
    hash ^= signature.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `AB-${(hash >>> 0).toString(36).toUpperCase().padStart(7, "0").slice(-7)}`;
}

function modelLines(config: BuilderConfig, photo: PhotoIdentity) {
  if (photo.active) {
    return [
      `Model bazowy 1:1: ${photo.productName || "Produkt A-Bags"}`,
      `ID produktu bazowego: ${photo.productId}`,
    ];
  }
  return [`Fason: ${label(FAMILY_LABELS, config.family)}`];
}

function specification(config: BuilderConfig, photo: PhotoIdentity) {
  const code = projectCode(config, photo);
  return [
    `A-Bags · projekt ${code}`,
    `Materiał: ${MATERIAL}`,
    ...modelLines(config, photo),
    `Kolor sznurka: ${label(COLOR_LABELS, config.color)}`,
    `Ścieg szydełkowy: ${label(STITCH_LABELS, config.stitch)}`,
    `Klapa: ${label(FLAP_LABELS, config.flap)}`,
    `Uchwyty: ${label(HANDLE_LABELS, config.handles)}`,
    `Pasek: ${label(STRAP_LABELS, config.strap)}`,
    `Okucia: ${label(HARDWARE_LABELS, config.hardware)}`,
    `Detal / ozdoba: ${label(ACCENT_LABELS, config.accent)}`,
    "Cena personalizacji: do indywidualnego potwierdzenia przez pracownię.",
  ].join("\n");
}

function isComplete(config: BuilderConfig, photo: PhotoIdentity) {
  return Boolean(config.family && config.color && config.stitch && (!photo.active || photo.productId));
}

function copyFallback(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  return copyFallback(text);
}

function ensureReviewCard(controls: HTMLElement, config: BuilderConfig, photo: PhotoIdentity) {
  const actions = controls.querySelector<HTMLElement>(".abags-builder-actions");
  if (!actions) return;

  let card = controls.querySelector<HTMLElement>("[data-builder-project-review]");
  if (!card) {
    card = document.createElement("div");
    card.className = "abags-builder-summary";
    card.dataset.builderProjectReview = "true";
    card.setAttribute("aria-live", "polite");
    actions.insertAdjacentElement("beforebegin", card);
  }

  const code = projectCode(config, photo);
  const complete = isComplete(config, photo);
  const content = `${code}|${photo.productId}|${photo.productName}|${Object.values(config).join("|")}|${complete}`;
  if (card.dataset.reviewSignature === content) return;
  card.dataset.reviewSignature = content;

  const heading = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = "Pełna specyfikacja projektu";
  const status = document.createElement("span");
  status.textContent = complete ? `kod ${code}` : "uzupełnij podstawę projektu";
  heading.append(title, status);

  const model = photo.active ? (photo.productName || "Produkt A-Bags") : label(FAMILY_LABELS, config.family);
  const summary = document.createElement("p");
  summary.textContent = complete
    ? `${model} · ${label(COLOR_LABELS, config.color)} · ${label(STITCH_LABELS, config.stitch)} · ${label(FLAP_LABELS, config.flap)} · ${label(HANDLE_LABELS, config.handles)} · ${label(STRAP_LABELS, config.strap)} · ${label(HARDWARE_LABELS, config.hardware)} · ${label(ACCENT_LABELS, config.accent)}`
    : "Wybierz model bazowy, kolor sznurka i ścieg szydełkowy, aby otrzymać kompletną specyfikację.";

  const material = document.createElement("small");
  material.textContent = photo.active
    ? `${MATERIAL}. Bazą projektu jest rzeczywisty produkt A-Bags 1:1. Kod projektu zmienia się wraz z modelem i konfiguracją.`
    : `${MATERIAL}. Kod projektu zmienia się automatycznie wraz z konfiguracją.`;

  card.replaceChildren(heading, summary, material);
}

function ensureCopyButton(controls: HTMLElement, stage: HTMLElement) {
  const actions = controls.querySelector<HTMLElement>(".abags-builder-actions");
  if (!actions) return;

  let button = actions.querySelector<HTMLButtonElement>("[data-builder-copy-spec]");
  if (!button) {
    button = document.createElement("button");
    button.type = "button";
    button.dataset.builderCopySpec = "true";
    button.textContent = "Kopiuj specyfikację";
    const send = actions.querySelector("a");
    if (send) actions.insertBefore(button, send);
    else actions.appendChild(button);

    button.addEventListener("click", async () => {
      const current = readConfig(stage);
      const photo = readPhotoIdentity(stage);
      if (!isComplete(current, photo)) return;
      const original = "Kopiuj specyfikację";
      try {
        const copied = await copyText(specification(current, photo));
        button!.textContent = copied ? "Skopiowano ✓" : "Nie udało się skopiować";
      } catch {
        button!.textContent = "Nie udało się skopiować";
      }
      window.setTimeout(() => { if (button) button.textContent = original; }, 1800);
    });
  }

  const config = readConfig(stage);
  const photo = readPhotoIdentity(stage);
  button.disabled = !isComplete(config, photo);
  button.setAttribute("aria-disabled", button.disabled ? "true" : "false");
}

function synchronizeWorkshopLink(controls: HTMLElement, config: BuilderConfig, photo: PhotoIdentity) {
  if (!isComplete(config, photo)) return;
  const link = controls.querySelector<HTMLAnchorElement>(".abags-builder-actions a");
  const href = link?.getAttribute("href");
  if (!link || !href) return;

  try {
    const url = new URL(href, window.location.origin);
    const text = url.searchParams.get("text");
    if (!text) return;
    const codeSentence = `Kod projektu: ${projectCode(config, photo)}.`;
    const modelSentence = photo.active ? `Model bazowy 1:1: ${photo.productName || "Produkt A-Bags"} [${photo.productId}].` : "";
    const withoutOldCode = text.replace(/\s*Kod projektu:\s*AB-[A-Z0-9]+\./g, "").trim();
    const withoutOldModel = withoutOldCode.replace(/\s*Model bazowy 1:1:[^\n]*?\[[^\]]+\]\./g, "").trim();
    const nextText = `${withoutOldModel}${modelSentence ? ` ${modelSentence}` : ""} ${codeSentence}`.trim();
    if (nextText === text) return;
    url.searchParams.set("text", nextText);
    link.setAttribute("href", url.toString());
  } catch {
    // Keep the original workshop link if its URL cannot be parsed.
  }
}

function synchronize() {
  const stage = document.querySelector<HTMLElement>(".abags-bag-builder-stage");
  const controls = document.querySelector<HTMLElement>(".abags-builder-controls");
  if (!stage || !controls) return;
  const config = readConfig(stage);
  const photo = readPhotoIdentity(stage);
  ensureReviewCard(controls, config, photo);
  ensureCopyButton(controls, stage);
  synchronizeWorkshopLink(controls, config, photo);
}

export default function BagBuilderProjectReview() {
  useEffect(() => {
    synchronize();
    const observer = new MutationObserver(synchronize);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-family", "data-color", "data-stitch", "data-flap", "data-handles", "data-strap", "data-hardware", "data-accent", "data-abags-photo-true", "data-photo-product-id", "data-photo-product-name"],
    });

    return () => {
      observer.disconnect();
      document.querySelector("[data-builder-project-review]")?.remove();
      document.querySelector("[data-builder-copy-spec]")?.remove();
    };
  }, []);

  return null;
}
