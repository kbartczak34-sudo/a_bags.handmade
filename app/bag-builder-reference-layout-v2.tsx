"use client";

import { useEffect } from "react";

const STEP_LABELS: Record<string, string> = {
  family: "Fason",
  color: "Kolor korpusu",
  stitch: "Splot",
  flap: "Klapa / zapięcie",
  handles: "Uchwyt / pasek",
  strap: "Uchwyt / pasek",
  hardware: "Dodatki",
  accent: "Dodatki",
};

function stepForKey(key: string) {
  if (key === "family") return 1;
  if (key === "color") return 2;
  if (key === "stitch") return 3;
  if (key === "flap") return 4;
  if (key === "handles" || key === "strap") return 5;
  if (key === "hardware" || key === "accent") return 6;
  return 7;
}

function inferredStep(stage: HTMLElement) {
  const explicit = Number(stage.dataset.abagsRefStep || "0");
  if (explicit >= 1 && explicit <= 7) return explicit;
  if (!stage.dataset.family) return 1;
  if (!stage.dataset.color) return 2;
  if (!stage.dataset.stitch) return 3;
  return 4;
}

function decorateDialog(dialog: HTMLElement) {
  dialog.classList.add("abags-target-layout-v2");

  const headerCopy = dialog.querySelector<HTMLElement>(".abags-vc-header > div");
  if (headerCopy && !headerCopy.querySelector(".abags-target-header-subtitle")) {
    const subtitle = document.createElement("p");
    subtitle.className = "abags-target-header-subtitle";
    subtitle.textContent = "Podgląd na żywo  •  Buduj warstwa po warstwie";
    headerCopy.appendChild(subtitle);
  }

  const stage = dialog.querySelector<HTMLElement>(".abags-bag-builder-stage");
  if (!stage) return;
  const current = inferredStep(stage);
  dialog.dataset.targetStep = String(current);

  const progress = dialog.querySelector<HTMLElement>(".abags-builder-heading > span");
  if (progress) progress.textContent = `${current}/7`;

  dialog.querySelectorAll<HTMLElement>(".abags-builder-group").forEach((group) => {
    const key = group.querySelector<HTMLButtonElement>("button[data-builder-key]")?.dataset.builderKey || "";
    if (!key) return;
    const step = stepForKey(key);
    group.dataset.targetKey = key;
    group.dataset.targetStep = String(step);
    group.classList.toggle("is-target-open", step === current);
    group.classList.toggle("is-target-secondary", key === "strap" || key === "accent");

    const legend = group.querySelector<HTMLElement>("legend");
    if (legend) {
      legend.dataset.targetLabel = STEP_LABELS[key] || legend.textContent || "";
      legend.setAttribute("aria-expanded", String(step === current));
    }
  });

  const material = dialog.querySelector<HTMLElement>("[data-builder-material='polyester-pimiotki']");
  if (material) material.classList.add("abags-target-material-note");
}

export default function BagBuilderReferenceLayoutV2() {
  useEffect(() => {
    let frame = 0;
    const sync = () => {
      frame = 0;
      const dialog = document.querySelector<HTMLElement>(".abags-vc-dialog.abags-vc-builder-active");
      if (dialog) decorateDialog(dialog);
    };
    const requestSync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(sync);
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const dialog = target?.closest<HTMLElement>(".abags-vc-dialog.abags-vc-builder-active");
      if (!dialog) return;
      const stage = dialog.querySelector<HTMLElement>(".abags-bag-builder-stage");
      if (!stage) return;

      const railButton = target?.closest<HTMLButtonElement>("button[data-ref-step]");
      if (railButton) {
        stage.dataset.abagsRefStep = railButton.dataset.refStep || "1";
        requestSync();
        return;
      }

      const legend = target?.closest<HTMLElement>(".abags-builder-group legend");
      const group = legend?.closest<HTMLElement>(".abags-builder-group");
      const key = group?.querySelector<HTMLButtonElement>("button[data-builder-key]")?.dataset.builderKey;
      if (key) {
        stage.dataset.abagsRefStep = String(stepForKey(key));
        requestSync();
      }
    };

    requestSync();
    const observer = new MutationObserver(requestSync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-family", "data-color", "data-stitch", "data-flap", "data-handles", "data-strap", "data-hardware", "data-accent", "data-abags-ref-step"],
    });
    document.addEventListener("click", onClick, true);
    window.addEventListener("resize", requestSync);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("resize", requestSync);
      if (frame) window.cancelAnimationFrame(frame);
      document.querySelectorAll<HTMLElement>(".abags-target-layout-v2").forEach((dialog) => {
        dialog.classList.remove("abags-target-layout-v2");
        delete dialog.dataset.targetStep;
        dialog.querySelector(".abags-target-header-subtitle")?.remove();
      });
    };
  }, []);

  return <style jsx global>{`
    .abags-vc-dialog.abags-target-layout-v2 {
      width: min(96vw, 1480px) !important;
      height: min(92dvh, 930px) !important;
      max-height: 92dvh !important;
      display: flex !important;
      flex-direction: column !important;
      overflow: hidden !important;
      border-radius: 28px !important;
      background: #fffaf8 !important;
      box-shadow: 0 34px 90px rgba(58, 38, 42, .24) !important;
    }

    .abags-target-layout-v2 .abags-vc-header {
      flex: 0 0 auto !important;
      min-height: 118px !important;
      padding: 18px 34px 16px !important;
      align-items: flex-start !important;
      border-bottom: 1px solid rgba(90, 66, 69, .12) !important;
      background: rgba(255, 250, 248, .98) !important;
    }

    .abags-target-layout-v2 .abags-vc-header .eyebrow {
      margin: 0 0 7px !important;
      font-size: 10px !important;
      letter-spacing: .22em !important;
    }

    .abags-target-layout-v2 .abags-vc-header h2 {
      display: block !important;
      margin: 0 !important;
      font-family: var(--font-display), Georgia, serif !important;
      font-size: clamp(38px, 4.2vw, 68px) !important;
      line-height: .94 !important;
      letter-spacing: -.045em !important;
      font-weight: 500 !important;
    }

    .abags-target-layout-v2 .abags-target-header-subtitle {
      margin: 7px 0 0 !important;
      font-size: 11px !important;
      letter-spacing: .04em !important;
      opacity: .68 !important;
    }

    .abags-target-layout-v2 .abags-vc-header > button {
      width: 46px !important;
      height: 46px !important;
      margin-top: 4px !important;
      border-radius: 50% !important;
      border: 1px solid rgba(90, 66, 69, .16) !important;
      background: #fff !important;
      font-size: 28px !important;
    }

    .abags-target-layout-v2 .abags-vc-layout {
      min-height: 0 !important;
      flex: 1 1 auto !important;
      display: grid !important;
      grid-template-columns: minmax(500px, .9fr) minmax(0, 1.45fr) !important;
      gap: 0 !important;
      overflow: hidden !important;
      background: #fffaf8 !important;
    }

    .abags-target-layout-v2 .abags-exact-live-mount {
      min-width: 0 !important;
      min-height: 0 !important;
      display: grid !important;
      grid-template-columns: 154px minmax(0, 1fr) !important;
      align-items: stretch !important;
      border-right: 1px solid rgba(90, 66, 69, .12) !important;
      background: #fffdfb !important;
      overflow: hidden !important;
    }

    .abags-target-layout-v2 .abags-ref-step-rail {
      grid-column: 1 !important;
      grid-row: 1 !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 2px !important;
      padding: 22px 12px !important;
      border-right: 1px solid rgba(90, 66, 69, .1) !important;
      background: #fffaf8 !important;
      overflow: auto !important;
    }

    .abags-target-layout-v2 .abags-ref-step-rail button {
      min-height: 52px !important;
      display: grid !important;
      grid-template-columns: 26px 1fr !important;
      gap: 8px !important;
      align-items: center !important;
      padding: 9px 8px !important;
      border: 0 !important;
      border-radius: 16px !important;
      background: transparent !important;
      color: var(--ink) !important;
      text-align: left !important;
    }

    .abags-target-layout-v2 .abags-ref-step-rail button > span {
      width: 25px !important;
      height: 25px !important;
      display: grid !important;
      place-items: center !important;
      border-radius: 50% !important;
      background: #fff !important;
      border: 1px solid rgba(90, 66, 69, .12) !important;
      font-size: 10px !important;
    }

    .abags-target-layout-v2 .abags-ref-step-rail button strong {
      font-size: 11px !important;
      line-height: 1.25 !important;
      font-weight: 600 !important;
    }

    .abags-target-layout-v2 .abags-ref-step-rail button.is-active {
      background: #f8e8e8 !important;
      color: #6f4950 !important;
    }

    .abags-target-layout-v2 .abags-ref-step-rail button.is-active > span {
      background: #b87880 !important;
      color: #fff !important;
      border-color: #b87880 !important;
    }

    .abags-target-layout-v2 .abags-builder-controls {
      grid-column: 2 !important;
      grid-row: 1 !important;
      min-width: 0 !important;
      min-height: 0 !important;
      padding: 20px 20px 26px !important;
      overflow-y: auto !important;
      background: #fffdfb !important;
      scrollbar-width: thin !important;
    }

    .abags-target-layout-v2 .abags-builder-heading {
      display: flex !important;
      align-items: flex-start !important;
      justify-content: space-between !important;
      gap: 12px !important;
      margin: 0 0 14px !important;
      padding: 0 0 14px !important;
      border-bottom: 1px solid rgba(90, 66, 69, .1) !important;
    }

    .abags-target-layout-v2 .abags-builder-heading .eyebrow,
    .abags-target-layout-v2 .abags-builder-heading p {
      display: none !important;
    }

    .abags-target-layout-v2 .abags-builder-heading h3 {
      margin: 0 !important;
      font-family: var(--font-display), Georgia, serif !important;
      font-size: 25px !important;
      font-weight: 500 !important;
      line-height: 1.05 !important;
    }

    .abags-target-layout-v2 .abags-builder-heading > span {
      flex: 0 0 auto !important;
      min-width: 48px !important;
      padding: 8px 10px !important;
      border-radius: 999px !important;
      background: #f6dddf !important;
      color: #9b6670 !important;
      font-size: 12px !important;
      font-weight: 700 !important;
      text-align: center !important;
    }

    .abags-target-layout-v2 .abags-target-material-note {
      display: none !important;
    }

    .abags-target-layout-v2 .abags-builder-group {
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
      border-bottom: 1px solid rgba(90, 66, 69, .1) !important;
      border-radius: 0 !important;
      background: transparent !important;
    }

    .abags-target-layout-v2 .abags-builder-group legend {
      width: 100% !important;
      min-height: 48px !important;
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      padding: 12px 2px !important;
      cursor: pointer !important;
      font-size: 0 !important;
      color: var(--ink) !important;
    }

    .abags-target-layout-v2 .abags-builder-group legend > span {
      width: 24px !important;
      height: 24px !important;
      display: grid !important;
      place-items: center !important;
      border-radius: 50% !important;
      background: #f4dddf !important;
      color: #9b6670 !important;
      font-size: 10px !important;
      font-weight: 700 !important;
    }

    .abags-target-layout-v2 .abags-builder-group legend::after {
      content: attr(data-target-label) !important;
      flex: 1 !important;
      font-family: var(--font-display), Georgia, serif !important;
      font-size: 18px !important;
      font-weight: 500 !important;
      text-align: left !important;
    }

    .abags-target-layout-v2 .abags-builder-group legend::before {
      content: "⌄" !important;
      order: 3 !important;
      font-size: 16px !important;
      transition: transform .18s ease !important;
      opacity: .7 !important;
    }

    .abags-target-layout-v2 .abags-builder-group.is-target-open legend::before {
      transform: rotate(180deg) !important;
    }

    .abags-target-layout-v2 .abags-builder-group:not(.is-target-open) .abags-builder-options,
    .abags-target-layout-v2 .abags-builder-group.is-target-secondary:not(.is-target-open) {
      display: none !important;
    }

    .abags-target-layout-v2 .abags-builder-group.is-target-secondary legend {
      display: none !important;
    }

    .abags-target-layout-v2 .abags-builder-group.is-target-open .abags-builder-options {
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 8px !important;
      padding: 2px 0 14px !important;
    }

    .abags-target-layout-v2 .abags-builder-group[data-target-key="family"] .abags-builder-options {
      grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    }

    .abags-target-layout-v2 .abags-builder-options button {
      min-width: 0 !important;
      min-height: 54px !important;
      padding: 8px !important;
      border: 1px solid rgba(90, 66, 69, .12) !important;
      border-radius: 13px !important;
      background: #fffaf8 !important;
      color: var(--ink) !important;
      box-shadow: none !important;
    }

    .abags-target-layout-v2 .abags-builder-options button.is-active {
      border-color: #d58d98 !important;
      box-shadow: 0 0 0 1px rgba(213, 141, 152, .34) !important;
      background: #fff7f7 !important;
    }

    .abags-target-layout-v2 .abags-ref-family-photo {
      width: 100% !important;
      aspect-ratio: 1.2 !important;
      display: block !important;
      margin: 0 0 7px !important;
      border-radius: 9px !important;
      background-repeat: no-repeat !important;
      background-color: #f5e9e3 !important;
    }

    .abags-target-layout-v2 .abags-builder-option-copy strong {
      font-size: 11px !important;
      line-height: 1.2 !important;
    }

    .abags-target-layout-v2 .abags-builder-option-copy small {
      margin-top: 2px !important;
      font-size: 8px !important;
      line-height: 1.25 !important;
      opacity: .6 !important;
    }

    .abags-target-layout-v2 .abags-builder-group[data-target-key="color"] .abags-builder-options {
      grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
    }

    .abags-target-layout-v2 .abags-builder-group[data-target-key="color"] .abags-builder-options button {
      min-height: 48px !important;
      padding: 6px 4px !important;
    }

    .abags-target-layout-v2 .abags-builder-swatch {
      width: 24px !important;
      height: 24px !important;
      border-radius: 50% !important;
      box-shadow: inset 0 0 0 1px rgba(45, 31, 34, .08) !important;
    }

    .abags-target-layout-v2 .abags-builder-summary:not([data-builder-material]) {
      margin: 16px 0 0 !important;
      padding: 14px !important;
      border-radius: 15px !important;
      border: 1px solid rgba(90, 66, 69, .1) !important;
      background: #fff8f6 !important;
    }

    .abags-target-layout-v2 .abags-builder-actions {
      display: grid !important;
      grid-template-columns: 1fr 1fr !important;
      gap: 8px !important;
      margin-top: 10px !important;
    }

    .abags-target-layout-v2 .abags-builder-actions a {
      grid-column: 1 / -1 !important;
      min-height: 48px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      border-radius: 13px !important;
      background: #d98291 !important;
      color: #fff !important;
      font-size: 11px !important;
      font-weight: 700 !important;
    }

    .abags-target-layout-v2 .abags-vc-preview-column {
      min-width: 0 !important;
      min-height: 0 !important;
      display: grid !important;
      grid-template-rows: minmax(0, 1fr) auto !important;
      gap: 0 !important;
      padding: 18px !important;
      overflow: hidden !important;
      background: #f8eee9 !important;
    }

    .abags-target-layout-v2 .abags-vc-preview {
      min-height: 0 !important;
      height: 100% !important;
      position: relative !important;
      overflow: hidden !important;
      border: 1px solid rgba(90, 66, 69, .1) !important;
      border-radius: 22px !important;
      background:
        radial-gradient(circle at 20% 18%, rgba(255,255,255,.96), transparent 24%),
        radial-gradient(circle at 82% 22%, rgba(236,204,188,.46), transparent 28%),
        linear-gradient(145deg, #f9eee7 0%, #f4dfd4 48%, #ead2c7 100%) !important;
      box-shadow: 0 18px 42px rgba(90, 66, 69, .1) !important;
    }

    .abags-target-layout-v2 .abags-vc-preview > .abags-vc-base,
    .abags-target-layout-v2 .abags-vc-preview > .abags-vc-layer,
    .abags-target-layout-v2 .abags-vc-live-badge,
    .abags-target-layout-v2 .abags-vc-compare,
    .abags-target-layout-v2 .abags-vc-preview-note,
    .abags-target-layout-v2 .abags-vc-price,
    .abags-target-layout-v2 .abags-vc-summary,
    .abags-target-layout-v2 .abags-vc-controls,
    .abags-target-layout-v2 .abags-vc-footer {
      display: none !important;
    }

    .abags-target-layout-v2 .abags-bag-builder-stage {
      width: 100% !important;
      height: 100% !important;
      min-height: 0 !important;
      position: relative !important;
      overflow: hidden !important;
      background: transparent !important;
      touch-action: none !important;
    }

    .abags-target-layout-v2 .abags-bag-builder-stage > svg,
    .abags-target-layout-v2 .abags-atelier-v7-layer,
    .abags-target-layout-v2 .abags-canvas3d-layer,
    .abags-target-layout-v2 .abags-material-pass,
    .abags-target-layout-v2 .abags-construction-pass {
      display: none !important;
    }

    .abags-target-layout-v2 .abags-pro3d-layer.abags-fidelity3d-layer {
      display: block !important;
      position: absolute !important;
      inset: 0 !important;
      z-index: 3 !important;
    }

    .abags-target-layout-v2 .abags-pro3d-canvas.abags-fidelity3d-canvas {
      width: 100% !important;
      height: 100% !important;
      display: block !important;
      touch-action: none !important;
    }

    .abags-target-layout-v2 .abags-builder-preview-status {
      position: absolute !important;
      left: 18px !important;
      right: 18px !important;
      bottom: 16px !important;
      z-index: 8 !important;
      width: auto !important;
      padding: 10px 14px !important;
      border-radius: 14px !important;
      background: rgba(255, 250, 248, .9) !important;
      backdrop-filter: blur(12px) !important;
      border: 1px solid rgba(90, 66, 69, .1) !important;
      text-align: center !important;
    }

    .abags-target-layout-v2 .abags-pro3d-chip {
      top: 16px !important;
      left: 16px !important;
      max-width: 52% !important;
      padding: 9px 12px !important;
      border-radius: 999px !important;
      background: rgba(255, 250, 248, .92) !important;
      color: #5a4245 !important;
      border: 1px solid rgba(90, 66, 69, .1) !important;
      font-size: 9px !important;
      letter-spacing: .08em !important;
      backdrop-filter: blur(12px) !important;
    }

    .abags-target-layout-v2 .abags-pro3d-view-controls {
      top: 16px !important;
      right: 16px !important;
      padding: 5px !important;
      border-radius: 999px !important;
      background: rgba(255, 250, 248, .92) !important;
      border: 1px solid rgba(90, 66, 69, .1) !important;
      backdrop-filter: blur(12px) !important;
    }

    .abags-target-layout-v2 .abags-pro3d-view-controls button {
      min-width: 58px !important;
      min-height: 34px !important;
      border-radius: 999px !important;
      border: 0 !important;
      background: transparent !important;
      font-size: 10px !important;
    }

    .abags-target-layout-v2 .abags-pro3d-view-controls button.is-active {
      background: #f1dddc !important;
    }

    .abags-target-layout-v2 .abags-pro3d-zoom {
      left: 18px !important;
      bottom: 72px !important;
      z-index: 8 !important;
      padding: 6px 8px !important;
      border-radius: 999px !important;
      background: rgba(255, 250, 248, .9) !important;
      border: 1px solid rgba(90, 66, 69, .1) !important;
      backdrop-filter: blur(12px) !important;
    }

    .abags-target-layout-v2 .abags-pro3d-hint {
      display: none !important;
    }

    .abags-target-layout-v2 .abags-ref-layers {
      width: min(210px, 28%) !important;
      position: absolute !important;
      top: 74px !important;
      right: 16px !important;
      z-index: 7 !important;
      padding: 12px !important;
      border-radius: 16px !important;
      background: rgba(255, 250, 248, .9) !important;
      border: 1px solid rgba(90, 66, 69, .1) !important;
      backdrop-filter: blur(14px) !important;
      box-shadow: 0 12px 28px rgba(90, 66, 69, .1) !important;
    }

    .abags-target-layout-v2 .abags-ref-layers-head strong {
      font-size: 10px !important;
      letter-spacing: .06em !important;
      text-transform: uppercase !important;
    }

    .abags-target-layout-v2 .abags-ref-layers-head small,
    .abags-target-layout-v2 .abags-ref-layer-edit {
      font-size: 8px !important;
      opacity: .58 !important;
    }

    .abags-target-layout-v2 .abags-ref-layer-row {
      min-height: 34px !important;
      padding: 4px 0 !important;
      border: 0 !important;
      background: transparent !important;
    }

    .abags-target-layout-v2 .abags-ref-inspirations {
      margin-top: 12px !important;
      padding: 12px !important;
      border-radius: 18px !important;
      border: 1px solid rgba(90, 66, 69, .1) !important;
      background: rgba(255, 250, 248, .86) !important;
    }

    .abags-target-layout-v2 .abags-ref-inspiration-head {
      display: flex !important;
      justify-content: space-between !important;
      gap: 12px !important;
      margin-bottom: 8px !important;
    }

    .abags-target-layout-v2 .abags-ref-inspiration-head strong {
      font-size: 10px !important;
      letter-spacing: .08em !important;
      text-transform: uppercase !important;
    }

    .abags-target-layout-v2 .abags-ref-inspiration-head small {
      font-size: 8px !important;
      opacity: .58 !important;
    }

    .abags-target-layout-v2 .abags-ref-inspiration-track {
      display: grid !important;
      grid-auto-flow: column !important;
      grid-auto-columns: minmax(120px, 1fr) !important;
      gap: 8px !important;
      overflow-x: auto !important;
      overscroll-behavior-inline: contain !important;
      scrollbar-width: none !important;
    }

    .abags-target-layout-v2 .abags-ref-inspiration-track::-webkit-scrollbar {
      display: none !important;
    }

    .abags-target-layout-v2 .abags-ref-inspiration-track > button {
      min-width: 0 !important;
      display: grid !important;
      grid-template-columns: 62px 1fr !important;
      align-items: center !important;
      gap: 8px !important;
      padding: 6px !important;
      border: 1px solid rgba(90, 66, 69, .1) !important;
      border-radius: 13px !important;
      background: #fffaf8 !important;
      text-align: left !important;
    }

    .abags-target-layout-v2 .abags-ref-photo {
      width: 62px !important;
      aspect-ratio: 1.12 !important;
      display: block !important;
      border-radius: 9px !important;
      background-repeat: no-repeat !important;
      background-color: #f0ded6 !important;
    }

    .abags-target-layout-v2 .abags-ref-inspiration-copy strong {
      font-size: 10px !important;
    }

    .abags-target-layout-v2 .abags-ref-inspiration-copy small {
      display: block !important;
      margin-top: 2px !important;
      font-size: 8px !important;
      opacity: .58 !important;
    }

    .abags-target-layout-v2 .abags-ref-trust {
      flex: 0 0 auto !important;
      min-height: 42px !important;
      display: grid !important;
      grid-template-columns: repeat(4, 1fr) !important;
      align-items: center !important;
      gap: 8px !important;
      padding: 8px 24px !important;
      border-top: 1px solid rgba(90, 66, 69, .1) !important;
      background: #fffaf8 !important;
      font-size: 8px !important;
      text-align: center !important;
    }

    @media (max-width: 820px) {
      .abags-vc-dialog.abags-target-layout-v2 {
        width: 100vw !important;
        height: 100dvh !important;
        max-height: 100dvh !important;
        border-radius: 0 !important;
      }

      .abags-target-layout-v2 .abags-vc-header {
        min-height: 64px !important;
        height: 64px !important;
        padding: 12px 14px !important;
        align-items: center !important;
      }

      .abags-target-layout-v2 .abags-vc-header .eyebrow {
        margin: 0 !important;
        font-size: 10px !important;
        letter-spacing: .14em !important;
      }

      .abags-target-layout-v2 .abags-vc-header h2,
      .abags-target-layout-v2 .abags-target-header-subtitle {
        display: none !important;
      }

      .abags-target-layout-v2 .abags-vc-header > button {
        width: 40px !important;
        height: 40px !important;
        margin: 0 !important;
        font-size: 24px !important;
      }

      .abags-target-layout-v2 .abags-vc-layout {
        display: flex !important;
        flex-direction: column !important;
        min-height: 0 !important;
        overflow-y: auto !important;
        overscroll-behavior: contain !important;
        background: #fffaf8 !important;
      }

      .abags-target-layout-v2 .abags-vc-preview-column {
        order: 1 !important;
        display: block !important;
        flex: 0 0 auto !important;
        padding: 0 !important;
        overflow: visible !important;
        background: #f8eee9 !important;
      }

      .abags-target-layout-v2 .abags-vc-preview {
        height: min(52dvh, 430px) !important;
        min-height: 330px !important;
        border: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
      }

      .abags-target-layout-v2 .abags-exact-live-mount {
        order: 2 !important;
        display: block !important;
        min-height: 0 !important;
        overflow: visible !important;
        border: 0 !important;
      }

      .abags-target-layout-v2 .abags-ref-step-rail {
        display: none !important;
      }

      .abags-target-layout-v2 .abags-builder-controls {
        display: block !important;
        padding: 14px 16px 30px !important;
        overflow: visible !important;
        background: #fffaf8 !important;
      }

      .abags-target-layout-v2 .abags-builder-heading {
        min-height: 46px !important;
        align-items: center !important;
        margin: 0 0 4px !important;
        padding: 0 2px 8px !important;
      }

      .abags-target-layout-v2 .abags-builder-heading > div {
        display: none !important;
      }

      .abags-target-layout-v2 .abags-builder-heading > span {
        min-width: 54px !important;
        padding: 8px 12px !important;
        font-size: 14px !important;
      }

      .abags-target-layout-v2 .abags-builder-group legend {
        min-height: 52px !important;
        padding: 13px 0 !important;
      }

      .abags-target-layout-v2 .abags-builder-group legend::after {
        font-size: 18px !important;
      }

      .abags-target-layout-v2 .abags-builder-group.is-target-open .abags-builder-options {
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 8px !important;
        padding-bottom: 14px !important;
      }

      .abags-target-layout-v2 .abags-builder-group[data-target-key="family"] .abags-builder-options {
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
      }

      .abags-target-layout-v2 .abags-builder-group[data-target-key="color"] .abags-builder-options {
        grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
      }

      .abags-target-layout-v2 .abags-builder-options button {
        min-height: 50px !important;
      }

      .abags-target-layout-v2 .abags-ref-family-photo {
        aspect-ratio: 1.05 !important;
      }

      .abags-target-layout-v2 .abags-pro3d-chip {
        top: 12px !important;
        left: 12px !important;
        max-width: 58% !important;
        padding: 7px 9px !important;
        font-size: 8px !important;
      }

      .abags-target-layout-v2 .abags-pro3d-view-controls {
        top: 10px !important;
        right: 10px !important;
      }

      .abags-target-layout-v2 .abags-pro3d-view-controls button {
        min-width: 48px !important;
        min-height: 32px !important;
        font-size: 9px !important;
      }

      .abags-target-layout-v2 .abags-pro3d-zoom,
      .abags-target-layout-v2 .abags-ref-layers {
        display: none !important;
      }

      .abags-target-layout-v2 .abags-builder-preview-status {
        left: 12px !important;
        right: 12px !important;
        bottom: 12px !important;
        padding: 8px 10px !important;
      }

      .abags-target-layout-v2 .abags-builder-preview-status span {
        display: none !important;
      }

      .abags-target-layout-v2 .abags-ref-inspirations {
        margin: 0 !important;
        padding: 9px 10px 10px !important;
        border-width: 1px 0 !important;
        border-radius: 0 !important;
        background: #fffaf8 !important;
      }

      .abags-target-layout-v2 .abags-ref-inspiration-head {
        margin: 0 0 7px !important;
      }

      .abags-target-layout-v2 .abags-ref-inspiration-head small {
        display: none !important;
      }

      .abags-target-layout-v2 .abags-ref-inspiration-track {
        grid-auto-columns: 88px !important;
        gap: 7px !important;
      }

      .abags-target-layout-v2 .abags-ref-inspiration-track > button {
        display: block !important;
        padding: 4px !important;
        border-radius: 11px !important;
      }

      .abags-target-layout-v2 .abags-ref-photo {
        width: 100% !important;
        aspect-ratio: 1.18 !important;
      }

      .abags-target-layout-v2 .abags-ref-inspiration-copy {
        display: none !important;
      }

      .abags-target-layout-v2 .abags-ref-trust {
        display: none !important;
      }

      .abags-target-layout-v2 .abags-builder-actions {
        position: relative !important;
      }
    }

    @media (max-width: 430px) {
      .abags-target-layout-v2 .abags-vc-preview {
        height: 43dvh !important;
        min-height: 300px !important;
      }

      .abags-target-layout-v2 .abags-pro3d-view-controls button {
        min-width: 43px !important;
        padding-inline: 5px !important;
      }

      .abags-target-layout-v2 .abags-builder-controls {
        padding-inline: 14px !important;
      }
    }
  `}</style>;
}
