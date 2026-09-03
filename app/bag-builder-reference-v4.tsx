"use client";

import { useEffect } from "react";

const NEXT_STEP: Record<string, number> = {
  family: 2,
  color: 3,
  stitch: 4,
  flap: 5,
  handles: 5,
  strap: 6,
  hardware: 6,
  accent: 7,
};

const SUBGROUP_LABELS: Record<string, string> = {
  handles: "Uchwyt",
  strap: "Pasek",
  hardware: "Okucia",
  accent: "Ozdoba",
};

function builderKey(group: HTMLElement) {
  return group.querySelector<HTMLButtonElement>("button[data-builder-key]")?.dataset.builderKey || "";
}

function ensureSubgroupLabels(dialog: HTMLElement) {
  dialog.querySelectorAll<HTMLElement>(".abags-builder-group").forEach((group) => {
    const key = builderKey(group);
    if (!key) return;
    group.dataset.v4Key = key;
    const text = SUBGROUP_LABELS[key];
    if (!text) return;
    let label = group.querySelector<HTMLElement>(":scope > .abags-v4-subgroup-label");
    if (!label) {
      label = document.createElement("div");
      label.className = "abags-v4-subgroup-label";
      const options = group.querySelector(".abags-builder-options");
      if (options) group.insertBefore(label, options);
      else group.appendChild(label);
    }
    if (label.textContent !== text) label.textContent = text;
  });
}

function ensurePreviewMeta(dialog: HTMLElement) {
  const preview = dialog.querySelector<HTMLElement>(".abags-vc-preview");
  if (!preview) return;
  let meta = preview.querySelector<HTMLElement>(":scope > .abags-v4-preview-meta");
  if (!meta) {
    meta = document.createElement("div");
    meta.className = "abags-v4-preview-meta";
    meta.innerHTML = "<strong>PODGLĄD NA ŻYWO</strong><span>Buduj warstwa po warstwie</span>";
    preview.prepend(meta);
  }
}

function ensureHeaderTools(dialog: HTMLElement) {
  const header = dialog.querySelector<HTMLElement>(".abags-vc-header");
  if (!header) return;

  let menu = header.querySelector<HTMLButtonElement>("[data-abags-v4-menu]");
  if (!menu) {
    menu = document.createElement("button");
    menu.type = "button";
    menu.className = "abags-v4-header-tool abags-v4-menu";
    menu.dataset.abagsV4Menu = "true";
    menu.setAttribute("aria-label", "Przejdź do konfiguracji");
    menu.innerHTML = "<span></span><span></span><span></span>";
    menu.addEventListener("click", () => {
      const stage = dialog.querySelector<HTMLElement>(".abags-bag-builder-stage");
      if (stage) stage.dataset.abagsRefStep = "1";
      dialog.querySelector<HTMLElement>(".abags-builder-controls")?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.requestAnimationFrame(() => dialog.querySelector<HTMLButtonElement>('button[data-builder-key="family"]')?.focus({ preventScroll: true }));
    });
    header.appendChild(menu);
  }

  let share = header.querySelector<HTMLButtonElement>("[data-abags-v4-share]");
  if (!share) {
    share = document.createElement("button");
    share.type = "button";
    share.className = "abags-v4-header-tool abags-v4-share";
    share.dataset.abagsV4Share = "true";
    share.setAttribute("aria-label", "Udostępnij projekt");
    share.textContent = "↗";
    share.addEventListener("click", () => dialog.querySelector<HTMLButtonElement>("[data-builder-share-project]")?.click());
    header.appendChild(share);
  }

  const sourceShare = dialog.querySelector<HTMLButtonElement>("[data-builder-share-project]");
  share.disabled = Boolean(sourceShare?.disabled);
  share.setAttribute("aria-disabled", share.disabled ? "true" : "false");
}

function initializeStep(stage: HTMLElement) {
  if (stage.dataset.abagsV4Initialized === "true") return;
  stage.dataset.abagsV4Initialized = "true";
  stage.dataset.abagsRefStep = "1";
}

function boostInitialModel(stage: HTMLElement) {
  if (stage.dataset.abagsV4Zoomed === "true") return;
  const zoom = stage.querySelector<HTMLInputElement>('.abags-pro3d-zoom input[type="range"]');
  if (!zoom) return;
  stage.dataset.abagsV4Zoomed = "true";
  const current = Number(zoom.value || "80");
  if (current >= 104) return;
  const plus = stage.querySelector<HTMLButtonElement>('.abags-pro3d-zoom button[aria-label="Przybliż model"]');
  if (!plus) return;
  const clicks = Math.min(4, Math.max(1, Math.ceil((108 - current) / 10)));
  for (let index = 0; index < clicks; index += 1) plus.click();
}

function sync(dialog: HTMLElement) {
  const stage = dialog.querySelector<HTMLElement>(".abags-bag-builder-stage");
  if (!stage) return;
  dialog.classList.add("abags-reference-layout-v4");
  dialog.dataset.abagsReferenceV4 = "true";
  initializeStep(stage);
  ensureHeaderTools(dialog);
  ensurePreviewMeta(dialog);
  ensureSubgroupLabels(dialog);
  boostInitialModel(stage);
}

export default function BagBuilderReferenceV4() {
  useEffect(() => {
    let frame = 0;
    const run = () => {
      frame = 0;
      const dialog = document.querySelector<HTMLElement>(".abags-vc-dialog.abags-vc-builder-active");
      if (dialog) sync(dialog);
    };
    const requestSync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(run);
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLButtonElement>("button[data-builder-key]");
      if (!button || button.disabled) return;
      const dialog = button.closest<HTMLElement>(".abags-vc-dialog.abags-reference-layout-v4");
      const stage = dialog?.querySelector<HTMLElement>(".abags-bag-builder-stage");
      const key = button.dataset.builderKey || "";
      const next = NEXT_STEP[key];
      if (!stage || !next) return;
      window.setTimeout(() => {
        stage.dataset.abagsRefStep = String(next);
        requestSync();
      }, 90);
    };

    requestSync();
    const observer = new MutationObserver(requestSync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "data-family", "data-color", "data-stitch", "data-flap", "data-handles", "data-strap", "data-hardware", "data-accent",
        "data-abags-pro3d-ready", "disabled", "data-abags-ref-step",
      ],
    });
    document.addEventListener("click", onClick, true);
    window.addEventListener("resize", requestSync);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("resize", requestSync);
      if (frame) window.cancelAnimationFrame(frame);
      document.querySelectorAll<HTMLElement>(".abags-reference-layout-v4").forEach((dialog) => {
        dialog.classList.remove("abags-reference-layout-v4");
        delete dialog.dataset.abagsReferenceV4;
        dialog.querySelectorAll(".abags-v4-header-tool,.abags-v4-preview-meta,.abags-v4-subgroup-label").forEach((node) => node.remove());
      });
    };
  }, []);

  return null;
}
