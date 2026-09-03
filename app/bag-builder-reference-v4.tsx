"use client";

import { useEffect } from "react";

const STEP_FOR_KEY: Record<string, number> = {
  family: 1,
  color: 2,
  stitch: 3,
  flap: 4,
  handles: 5,
  strap: 5,
  hardware: 6,
  accent: 6,
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

function activeStep(stage: HTMLElement) {
  const value = Number(stage.dataset.abagsRefStep || "1");
  return value >= 1 && value <= 7 ? value : 1;
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

function synchronizeGroups(dialog: HTMLElement, stage: HTMLElement) {
  const step = activeStep(stage);
  dialog.dataset.v4Step = String(step);
  dialog.dataset.referenceStep = String(step);

  dialog.querySelectorAll<HTMLElement>(".abags-builder-group").forEach((group) => {
    const key = builderKey(group);
    const groupStep = STEP_FOR_KEY[key];
    if (!groupStep) return;
    const open = step === groupStep;
    group.dataset.v4Key = key;
    group.dataset.v4Step = String(groupStep);
    group.classList.toggle("is-v3-open", open);
    group.classList.toggle("is-ref-expanded", open);
    const legend = group.querySelector<HTMLElement>("legend");
    legend?.setAttribute("aria-expanded", String(open));
  });
}

function tagCoreSummary(dialog: HTMLElement) {
  const controls = dialog.querySelector<HTMLElement>(".abags-builder-controls");
  if (!controls) return;
  controls.querySelectorAll<HTMLElement>(":scope > .abags-builder-summary").forEach((card) => {
    if (card.dataset.builderMaterial || card.dataset.builderValidationStatus || card.dataset.builderProjectReview || card.dataset.builderShareNotice) return;
    if (card.querySelector("strong")?.textContent?.trim() === "Twój projekt") card.dataset.v4CoreSummary = "true";
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
    share.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3m0 0 4 4m-4-4L8 7M5 11v8h14v-8"/></svg>';
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
  synchronizeGroups(dialog, stage);
  tagCoreSummary(dialog);
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
      const step = STEP_FOR_KEY[key];
      if (!stage || !step) return;
      window.setTimeout(() => {
        // Selecting an option keeps its accordion open, like the approved reference.
        stage.dataset.abagsRefStep = String(step);
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
        delete dialog.dataset.v4Step;
        dialog.querySelectorAll(".abags-v4-header-tool,.abags-v4-preview-meta,.abags-v4-subgroup-label").forEach((node) => node.remove());
      });
    };
  }, []);

  // This style is intentionally rendered by the last visual controller. It
  // wins over the older V3 runtime style tag without removing compatibility
  // classes that the production browser and touch tests still exercise.
  return <style jsx global>{`
    .abags-reference-layout-v4 .abags-builder-heading { order: 0 !important; }
    .abags-reference-layout-v4 .abags-builder-group { order: 10 !important; }
    .abags-reference-layout-v4 [data-v4-core-summary] { order: 60 !important; }
    .abags-reference-layout-v4 [data-abags-builder-commerce] { order: 70 !important; }
    .abags-reference-layout-v4 [data-builder-material] { order: 72 !important; }
    .abags-reference-layout-v4 [data-builder-validation-status] { order: 73 !important; }
    .abags-reference-layout-v4 [data-builder-project-review] { order: 74 !important; }
    .abags-reference-layout-v4 [data-builder-checkout-handoff] { order: 75 !important; }
    .abags-reference-layout-v4 [data-builder-share-notice] { order: 76 !important; }
    .abags-reference-layout-v4 .abags-builder-actions { order: 90 !important; }

    .abags-reference-layout-v4 .abags-pro3d-zoom {
      opacity: 0 !important;
      pointer-events: auto !important;
    }

    @media (max-width: 980px) {
      .abags-reference-layout-v4 .abags-vc-header > button.abags-v4-menu {
        display: grid !important;
        position: absolute !important;
        top: 9px !important;
        left: 10px !important;
        right: auto !important;
        width: 34px !important;
        height: 34px !important;
        padding: 0 !important;
        place-content: center !important;
        gap: 3px !important;
        border: 0 !important;
        border-radius: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
      }
      .abags-reference-layout-v4 .abags-vc-header > button.abags-v4-menu span {
        display: block !important;
        width: 15px !important;
        height: 1.5px !important;
        border-radius: 2px !important;
        background: #5c454a !important;
      }
      .abags-reference-layout-v4 .abags-vc-header > button.abags-v4-share {
        display: grid !important;
        position: absolute !important;
        top: 9px !important;
        right: 43px !important;
        left: auto !important;
        width: 32px !important;
        height: 32px !important;
        padding: 5px !important;
        place-items: center !important;
        border: 0 !important;
        border-radius: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
      }
      .abags-reference-layout-v4 .abags-vc-header > button.abags-v4-share svg {
        width: 17px !important;
        height: 17px !important;
        fill: none !important;
        stroke: currentColor !important;
        stroke-width: 1.7 !important;
        stroke-linecap: round !important;
        stroke-linejoin: round !important;
      }
      .abags-reference-layout-v4 .abags-vc-header > button:not(.abags-v4-header-tool) {
        top: 11px !important;
        right: 7px !important;
        left: auto !important;
        width: 28px !important;
        height: 28px !important;
        padding: 0 !important;
        border: 0 !important;
        border-radius: 50% !important;
        background: transparent !important;
        box-shadow: none !important;
        font-size: 15px !important;
      }

      .abags-reference-layout-v4 .abags-pro3d-chip,
      .abags-reference-layout-v4 .abags-pro3d-hint { display: none !important; }
      .abags-reference-layout-v4 .abags-pro3d-view-controls {
        opacity: .02 !important;
        pointer-events: auto !important;
      }
      .abags-reference-layout-v4 .abags-pro3d-zoom {
        opacity: 0 !important;
        pointer-events: auto !important;
      }

      .abags-reference-layout-v4 [data-builder-material] { display: none !important; }
      .abags-reference-layout-v4:not([data-v4-step="7"]) [data-v4-core-summary],
      .abags-reference-layout-v4:not([data-v4-step="7"]) [data-builder-validation-status],
      .abags-reference-layout-v4:not([data-v4-step="7"]) [data-builder-project-review],
      .abags-reference-layout-v4:not([data-v4-step="7"]) [data-builder-checkout-handoff],
      .abags-reference-layout-v4:not([data-v4-step="7"]) [data-builder-share-notice] {
        display: none !important;
      }

      .abags-reference-layout-v4 .abags-builder-actions {
        position: relative !important;
        bottom: auto !important;
        margin: 8px 0 0 !important;
        padding: 8px 0 calc(12px + env(safe-area-inset-bottom)) !important;
        background: transparent !important;
        border-top: 0 !important;
        box-shadow: none !important;
        backdrop-filter: none !important;
      }
      .abags-reference-layout-v4 .abags-builder-actions > button:first-child,
      .abags-reference-layout-v4 .abags-builder-actions [data-builder-copy-spec],
      .abags-reference-layout-v4 .abags-builder-actions [data-builder-share-project] {
        display: none !important;
      }
      .abags-reference-layout-v4 .abags-builder-actions > a {
        order: 1 !important;
        min-height: 42px !important;
      }
      .abags-reference-layout-v4 .abags-builder-actions > button[data-builder-save-state] {
        order: 2 !important;
        min-height: 38px !important;
      }

      .abags-reference-layout-v4 [data-abags-builder-commerce] {
        margin-top: 7px !important;
      }
      .abags-reference-layout-v4 .abags-builder-commerce {
        padding: 8px 9px !important;
        border-radius: 10px !important;
      }
      .abags-reference-layout-v4 .abags-builder-commerce-head { display: none !important; }
      .abags-reference-layout-v4 .abags-builder-live-price {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 10px !important;
      }
      .abags-reference-layout-v4 .abags-builder-live-price strong {
        font-size: 16px !important;
      }
      .abags-reference-layout-v4 .abags-builder-live-price small {
        display: none !important;
      }
      .abags-reference-layout-v4 .abags-builder-price-breakdown { display: none !important; }
    }
  `}</style>;
}
