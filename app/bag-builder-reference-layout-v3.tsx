"use client";

import { useEffect } from "react";

const STEP_TITLES: Record<number, string> = {
  1: "1. Fason",
  2: "2. Kolor korpusu",
  3: "3. Splot",
  4: "4. Klapa / zapięcie",
  5: "5. Uchwyt / pasek",
  6: "6. Dodatki",
  7: "7. Podsumowanie",
};

const STEP_HELP: Record<number, string> = {
  1: "Wybierz kształt swojej torebki",
  2: "Wybierz kolor sznurka poliestrowego",
  3: "Wybierz strukturę splotu",
  4: "Dobierz klapę i sposób wykończenia",
  5: "Wybierz uchwyt oraz pasek",
  6: "Dobierz okucia i ozdobę",
  7: "Sprawdź projekt przed zapisaniem lub zakupem",
};

const GROUP_LABELS: Record<string, string> = {
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

function currentStep(stage: HTMLElement) {
  const explicit = Number(stage.dataset.abagsRefStep || "0");
  if (explicit >= 1 && explicit <= 7) return explicit;
  if (!stage.dataset.family) return 1;
  if (!stage.dataset.color) return 2;
  if (!stage.dataset.stitch) return 3;
  return 4;
}

function ensureHeader(dialog: HTMLElement) {
  const header = dialog.querySelector<HTMLElement>(".abags-vc-header");
  if (!header) return;
  const eyebrow = header.querySelector<HTMLElement>(".eyebrow");
  const title = header.querySelector<HTMLElement>("h2");
  if (eyebrow) eyebrow.textContent = "A-BAGS VISUAL CUSTOMIZER";
  if (title) title.textContent = "Zbuduj swoją torebkę od podstaw";

  const copy = header.querySelector<HTMLElement>(":scope > div");
  if (copy && !copy.querySelector(".abags-v3-subtitle")) {
    const subtitle = document.createElement("p");
    subtitle.className = "abags-v3-subtitle";
    subtitle.textContent = "Podgląd na żywo  •  Buduj warstwa po warstwie";
    copy.appendChild(subtitle);
  }
  if (!header.querySelector(".abags-v3-wordmark")) {
    const mark = document.createElement("div");
    mark.className = "abags-v3-wordmark";
    mark.innerHTML = "<strong>a_bags</strong><small>HANDMADE</small>";
    header.appendChild(mark);
  }
}

function decorate(dialog: HTMLElement) {
  const stage = dialog.querySelector<HTMLElement>(".abags-bag-builder-stage");
  if (!stage) return;
  dialog.classList.add("abags-reference-layout-v3");
  dialog.dataset.abagsReferenceLayout = "v3";
  ensureHeader(dialog);

  const step = currentStep(stage);
  dialog.dataset.referenceStep = String(step);

  const heading = dialog.querySelector<HTMLElement>(".abags-builder-heading");
  const headingTitle = heading?.querySelector<HTMLElement>("h3");
  const headingText = heading?.querySelectorAll<HTMLElement>("p")?.[1];
  const progress = heading?.querySelector<HTMLElement>(":scope > span");
  if (headingTitle) headingTitle.textContent = STEP_TITLES[step];
  if (headingText) headingText.textContent = STEP_HELP[step];
  if (progress) progress.textContent = `${step}/7`;

  dialog.querySelectorAll<HTMLElement>(".abags-builder-group").forEach((group) => {
    const key = group.querySelector<HTMLButtonElement>("button[data-builder-key]")?.dataset.builderKey || "";
    if (!key) return;
    const groupStep = stepForKey(key);
    group.dataset.v3Key = key;
    group.dataset.v3Step = String(groupStep);
    group.classList.toggle("is-v3-open", groupStep === step);
    group.classList.toggle("is-v3-secondary", key === "strap" || key === "accent");
    const legend = group.querySelector<HTMLElement>("legend");
    if (legend) {
      legend.dataset.v3Label = GROUP_LABELS[key] || legend.textContent || "";
      legend.setAttribute("aria-expanded", String(groupStep === step));
    }
  });

  dialog.querySelector<HTMLElement>(".abags-builder-summary")?.classList.toggle("is-v3-summary-open", step === 7);
}

export default function BagBuilderReferenceLayoutV3() {
  useEffect(() => {
    let frame = 0;
    const sync = () => {
      frame = 0;
      const dialog = document.querySelector<HTMLElement>(".abags-vc-dialog.abags-vc-builder-active");
      if (dialog) decorate(dialog);
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

      const rail = target?.closest<HTMLButtonElement>("button[data-ref-step]");
      if (rail) {
        stage.dataset.abagsRefStep = rail.dataset.refStep || "1";
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
      document.querySelectorAll<HTMLElement>(".abags-reference-layout-v3").forEach((dialog) => {
        dialog.classList.remove("abags-reference-layout-v3");
        delete dialog.dataset.abagsReferenceLayout;
        delete dialog.dataset.referenceStep;
        dialog.querySelector(".abags-v3-subtitle")?.remove();
        dialog.querySelector(".abags-v3-wordmark")?.remove();
      });
    };
  }, []);

  return <style jsx global>{`
    .abags-vc-dialog.abags-reference-layout-v3 {
      width: min(96vw, 1540px) !important;
      height: min(94dvh, 960px) !important;
      max-height: 94dvh !important;
      display: flex !important;
      flex-direction: column !important;
      overflow: hidden !important;
      border: 1px solid rgba(90,66,69,.10) !important;
      border-radius: 26px !important;
      background: #fffaf7 !important;
      box-shadow: 0 32px 90px rgba(69,47,51,.22) !important;
    }

    .abags-reference-layout-v3 .abags-vc-header {
      position: relative !important;
      flex: 0 0 120px !important;
      min-height: 120px !important;
      display: flex !important;
      align-items: flex-start !important;
      justify-content: center !important;
      padding: 16px 90px 12px !important;
      border-bottom: 1px solid rgba(90,66,69,.11) !important;
      background: #fffaf7 !important;
    }

    .abags-reference-layout-v3 .abags-vc-header > div:first-child {
      width: 100% !important;
      text-align: center !important;
    }

    .abags-reference-layout-v3 .abags-vc-header .eyebrow {
      margin: 0 0 7px !important;
      color: #4e3b3e !important;
      font-size: 10px !important;
      font-weight: 700 !important;
      letter-spacing: .22em !important;
    }

    .abags-reference-layout-v3 .abags-vc-header h2 {
      margin: 0 !important;
      font-family: var(--font-display), Georgia, serif !important;
      font-size: clamp(42px, 4.1vw, 68px) !important;
      font-weight: 500 !important;
      line-height: .94 !important;
      letter-spacing: -.045em !important;
      color: #402f32 !important;
    }

    .abags-reference-layout-v3 .abags-v3-subtitle {
      margin: 8px 0 0 !important;
      color: rgba(64,47,50,.68) !important;
      font-size: 11px !important;
      letter-spacing: .03em !important;
    }

    .abags-reference-layout-v3 .abags-v3-wordmark {
      position: absolute !important;
      top: 17px !important;
      right: 28px !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      color: #4c393c !important;
      line-height: 1 !important;
    }
    .abags-reference-layout-v3 .abags-v3-wordmark strong {
      font-family: var(--font-display), Georgia, serif !important;
      font-size: 20px !important;
      font-style: italic !important;
      font-weight: 500 !important;
    }
    .abags-reference-layout-v3 .abags-v3-wordmark small {
      margin-top: 5px !important;
      font-size: 6px !important;
      font-weight: 700 !important;
      letter-spacing: .28em !important;
    }

    .abags-reference-layout-v3 .abags-vc-header > button {
      position: absolute !important;
      top: 20px !important;
      left: 28px !important;
      width: 42px !important;
      height: 42px !important;
      display: grid !important;
      place-items: center !important;
      margin: 0 !important;
      border: 1px solid rgba(90,66,69,.14) !important;
      border-radius: 50% !important;
      background: #fff !important;
      color: #674d53 !important;
      font-size: 25px !important;
      line-height: 1 !important;
      box-shadow: 0 8px 20px rgba(90,66,69,.06) !important;
    }

    .abags-reference-layout-v3 .abags-vc-layout {
      flex: 1 1 auto !important;
      min-height: 0 !important;
      display: grid !important;
      grid-template-columns: minmax(510px,.88fr) minmax(0,1.42fr) !important;
      gap: 0 !important;
      overflow: hidden !important;
      background: #fffaf7 !important;
    }

    .abags-reference-layout-v3 .abags-exact-live-mount {
      min-width: 0 !important;
      min-height: 0 !important;
      display: grid !important;
      grid-template-columns: 148px minmax(0,1fr) !important;
      border-right: 1px solid rgba(90,66,69,.11) !important;
      background: #fffdfb !important;
      overflow: hidden !important;
    }

    .abags-reference-layout-v3 .abags-ref-step-rail {
      grid-column: 1 !important;
      min-height: 0 !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 3px !important;
      padding: 20px 11px !important;
      overflow-y: auto !important;
      border-right: 1px solid rgba(90,66,69,.09) !important;
      background: #fffaf7 !important;
    }
    .abags-reference-layout-v3 .abags-ref-step-rail button {
      min-height: 51px !important;
      display: grid !important;
      grid-template-columns: 27px minmax(0,1fr) !important;
      gap: 8px !important;
      align-items: center !important;
      padding: 9px 8px !important;
      border: 0 !important;
      border-radius: 15px !important;
      background: transparent !important;
      color: #5a4245 !important;
      text-align: left !important;
      cursor: pointer !important;
    }
    .abags-reference-layout-v3 .abags-ref-step-rail button > span {
      width: 26px !important;
      height: 26px !important;
      display: grid !important;
      place-items: center !important;
      border: 1px solid rgba(90,66,69,.12) !important;
      border-radius: 50% !important;
      background: #fff !important;
      font-size: 10px !important;
      font-weight: 700 !important;
    }
    .abags-reference-layout-v3 .abags-ref-step-rail button strong {
      font-size: 10px !important;
      line-height: 1.2 !important;
      font-weight: 650 !important;
    }
    .abags-reference-layout-v3 .abags-ref-step-rail button.is-active {
      background: #f7e7e8 !important;
      color: #754e56 !important;
    }
    .abags-reference-layout-v3 .abags-ref-step-rail button.is-active > span {
      border-color: #b87880 !important;
      background: #b87880 !important;
      color: #fff !important;
    }

    .abags-reference-layout-v3 .abags-builder-controls {
      grid-column: 2 !important;
      min-width: 0 !important;
      min-height: 0 !important;
      display: flex !important;
      flex-direction: column !important;
      padding: 18px 18px 20px !important;
      overflow-y: auto !important;
      background: #fffdfb !important;
      scrollbar-width: thin !important;
    }

    .abags-reference-layout-v3 .abags-builder-heading {
      display: grid !important;
      grid-template-columns: 52px minmax(0,1fr) !important;
      gap: 12px !important;
      align-items: start !important;
      margin: 0 0 12px !important;
      padding: 0 0 12px !important;
      border-bottom: 1px solid rgba(90,66,69,.10) !important;
    }
    .abags-reference-layout-v3 .abags-builder-heading > span {
      grid-column: 1 !important;
      grid-row: 1 / span 2 !important;
      min-width: 48px !important;
      padding: 9px 8px !important;
      border-radius: 999px !important;
      background: #f5dddf !important;
      color: #9a636d !important;
      font-size: 12px !important;
      font-weight: 800 !important;
      text-align: center !important;
    }
    .abags-reference-layout-v3 .abags-builder-heading > div {
      grid-column: 2 !important;
      min-width: 0 !important;
    }
    .abags-reference-layout-v3 .abags-builder-heading .eyebrow { display: none !important; }
    .abags-reference-layout-v3 .abags-builder-heading h3 {
      margin: 0 !important;
      font-family: var(--font-display), Georgia, serif !important;
      font-size: 24px !important;
      font-weight: 500 !important;
      line-height: 1.03 !important;
      color: #49363a !important;
    }
    .abags-reference-layout-v3 .abags-builder-heading p:last-child {
      display: block !important;
      margin: 5px 0 0 !important;
      color: rgba(73,54,58,.62) !important;
      font-size: 10px !important;
      line-height: 1.4 !important;
    }

    .abags-reference-layout-v3 .abags-target-material-note,
    .abags-reference-layout-v3 [data-builder-material="polyester-pimiotki"] {
      display: none !important;
    }

    .abags-reference-layout-v3 .abags-builder-group {
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
      border-bottom: 1px solid rgba(90,66,69,.095) !important;
      border-radius: 0 !important;
      background: transparent !important;
    }
    .abags-reference-layout-v3 .abags-builder-group legend {
      width: 100% !important;
      min-height: 46px !important;
      display: flex !important;
      align-items: center !important;
      gap: 9px !important;
      padding: 10px 1px !important;
      color: #4e393d !important;
      cursor: pointer !important;
      font-size: 0 !important;
    }
    .abags-reference-layout-v3 .abags-builder-group legend > span {
      width: 24px !important;
      height: 24px !important;
      display: grid !important;
      place-items: center !important;
      border-radius: 50% !important;
      background: #f5dddf !important;
      color: #9a636d !important;
      font-size: 9px !important;
      font-weight: 800 !important;
    }
    .abags-reference-layout-v3 .abags-builder-group legend::after {
      content: attr(data-v3-label) !important;
      flex: 1 !important;
      font-family: var(--font-display), Georgia, serif !important;
      font-size: 17px !important;
      font-weight: 500 !important;
      text-align: left !important;
    }
    .abags-reference-layout-v3 .abags-builder-group legend::before {
      content: "⌄" !important;
      order: 3 !important;
      opacity: .62 !important;
      font-size: 15px !important;
      transition: transform .18s ease !important;
    }
    .abags-reference-layout-v3 .abags-builder-group.is-v3-open legend::before { transform: rotate(180deg) !important; }
    .abags-reference-layout-v3 .abags-builder-group.is-v3-secondary legend { display: none !important; }
    .abags-reference-layout-v3 .abags-builder-group:not(.is-v3-open) .abags-builder-options { display: none !important; }
    .abags-reference-layout-v3 .abags-builder-group.is-v3-open .abags-builder-options {
      display: grid !important;
      grid-template-columns: repeat(2,minmax(0,1fr)) !important;
      gap: 8px !important;
      padding: 2px 0 13px !important;
    }
    .abags-reference-layout-v3 .abags-builder-group[data-v3-key="family"] .abags-builder-options {
      grid-template-columns: repeat(2,minmax(0,1fr)) !important;
    }

    .abags-reference-layout-v3 .abags-builder-options button {
      min-width: 0 !important;
      min-height: 68px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: flex-start !important;
      gap: 9px !important;
      padding: 8px !important;
      border: 1px solid rgba(90,66,69,.12) !important;
      border-radius: 13px !important;
      background: #fffaf8 !important;
      color: #5a4245 !important;
      text-align: left !important;
      box-shadow: none !important;
      transition: border-color .16s ease, box-shadow .16s ease, transform .16s ease !important;
    }
    .abags-reference-layout-v3 .abags-builder-options button:hover {
      transform: translateY(-1px) !important;
      border-color: rgba(184,120,128,.48) !important;
      box-shadow: 0 8px 20px rgba(90,66,69,.07) !important;
    }
    .abags-reference-layout-v3 .abags-builder-options button.is-active {
      border-color: #c9838c !important;
      box-shadow: inset 0 0 0 1px #c9838c !important;
      background: #fff8f7 !important;
    }
    .abags-reference-layout-v3 .abags-builder-option-copy strong {
      display: block !important;
      font-size: 10px !important;
      font-weight: 700 !important;
      line-height: 1.2 !important;
    }
    .abags-reference-layout-v3 .abags-builder-option-copy small {
      display: block !important;
      margin-top: 3px !important;
      color: rgba(90,66,69,.58) !important;
      font-size: 8px !important;
      line-height: 1.25 !important;
    }

    .abags-reference-layout-v3 .abags-ref-family-photo {
      flex: 0 0 74px !important;
      width: 74px !important;
      height: 68px !important;
      display: block !important;
      border-radius: 10px !important;
      background-repeat: no-repeat !important;
      background-color: #f3e8e1 !important;
      box-shadow: inset 0 0 0 1px rgba(90,66,69,.08) !important;
    }

    .abags-reference-layout-v3 .abags-builder-group[data-v3-key="color"] .abags-builder-options {
      display: flex !important;
      flex-wrap: wrap !important;
      gap: 8px !important;
    }
    .abags-reference-layout-v3 .abags-builder-group[data-v3-key="color"] .abags-builder-options button {
      width: 42px !important;
      height: 42px !important;
      min-width: 42px !important;
      min-height: 42px !important;
      padding: 5px !important;
      border-radius: 50% !important;
      justify-content: center !important;
    }
    .abags-reference-layout-v3 .abags-builder-group[data-v3-key="color"] .abags-builder-option-copy { display: none !important; }
    .abags-reference-layout-v3 .abags-builder-group[data-v3-key="color"] .abags-builder-swatch {
      width: 28px !important;
      height: 28px !important;
      border-radius: 50% !important;
      box-shadow: inset 0 0 0 1px rgba(50,35,38,.09) !important;
    }

    .abags-reference-layout-v3 .abags-builder-group[data-v3-key="stitch"] .abags-builder-options button {
      min-height: 92px !important;
      flex-direction: column !important;
      align-items: stretch !important;
      gap: 7px !important;
    }
    .abags-reference-layout-v3 .abags-builder-group[data-v3-key="stitch"] .abags-builder-options button::before {
      content: "" !important;
      width: 100% !important;
      height: 55px !important;
      display: block !important;
      border-radius: 9px !important;
      background-color: #c89a7d !important;
      box-shadow: inset 0 0 0 1px rgba(74,49,43,.12) !important;
    }
    .abags-reference-layout-v3 button[data-builder-key="stitch"][data-builder-value="classic"]::before {
      background-image: repeating-linear-gradient(118deg,rgba(255,255,255,.32) 0 4px,rgba(70,43,39,.16) 4px 6px,transparent 6px 12px) !important;
    }
    .abags-reference-layout-v3 button[data-builder-key="stitch"][data-builder-value="herringbone"]::before {
      background-image: linear-gradient(135deg,rgba(255,255,255,.30) 25%,transparent 25%),linear-gradient(225deg,rgba(255,255,255,.22) 25%,transparent 25%),linear-gradient(45deg,rgba(72,46,42,.13) 25%,transparent 25%),linear-gradient(315deg,rgba(72,46,42,.13) 25%,#b87978 25%) !important;
      background-size: 18px 18px !important;
    }
    .abags-reference-layout-v3 button[data-builder-key="stitch"][data-builder-value="basket"]::before {
      background-image: repeating-linear-gradient(0deg,rgba(255,255,255,.22) 0 5px,transparent 5px 12px),repeating-linear-gradient(90deg,rgba(64,43,39,.14) 0 3px,transparent 3px 12px) !important;
    }
    .abags-reference-layout-v3 button[data-builder-key="stitch"][data-builder-value="shell"]::before {
      background-image: radial-gradient(ellipse at 50% 100%,transparent 0 36%,rgba(255,255,255,.30) 38% 48%,transparent 50%) !important;
      background-size: 24px 18px !important;
    }

    .abags-reference-layout-v3 .abags-builder-summary {
      display: none !important;
      margin: 14px 0 0 !important;
      padding: 13px !important;
      border: 1px solid rgba(90,66,69,.12) !important;
      border-radius: 13px !important;
      background: #fff8f6 !important;
    }
    .abags-reference-layout-v3 .abags-builder-summary.is-v3-summary-open { display: block !important; }

    .abags-reference-layout-v3 .abags-builder-commerce-mount {
      margin-top: auto !important;
      padding-top: 13px !important;
    }
    .abags-reference-layout-v3 .abags-builder-commerce {
      padding: 11px 12px !important;
      border: 1px solid rgba(90,66,69,.11) !important;
      border-radius: 13px !important;
      background: #fff9f7 !important;
    }
    .abags-reference-layout-v3 .abags-builder-commerce-head { display: none !important; }
    .abags-reference-layout-v3 .abags-builder-live-price {
      display: flex !important;
      align-items: end !important;
      justify-content: space-between !important;
      gap: 10px !important;
    }
    .abags-reference-layout-v3 .abags-builder-live-price > span { font-size: 9px !important; }
    .abags-reference-layout-v3 .abags-builder-live-price > strong {
      font-family: var(--font-display), Georgia, serif !important;
      font-size: 23px !important;
      font-weight: 600 !important;
      color: #3f2e31 !important;
    }
    .abags-reference-layout-v3 .abags-builder-live-price small {
      max-width: 180px !important;
      color: rgba(90,66,69,.58) !important;
      font-size: 8px !important;
      line-height: 1.3 !important;
    }
    .abags-reference-layout-v3 .abags-builder-price-breakdown { margin-top: 7px !important; font-size: 8px !important; }

    .abags-reference-layout-v3 .abags-builder-actions {
      display: grid !important;
      grid-template-columns: 1fr 1fr !important;
      gap: 7px !important;
      margin-top: 8px !important;
    }
    .abags-reference-layout-v3 .abags-builder-actions a {
      grid-column: 1 / -1 !important;
      grid-row: 1 !important;
      min-height: 44px !important;
      display: grid !important;
      place-items: center !important;
      padding: 10px 13px !important;
      border: 0 !important;
      border-radius: 11px !important;
      background: #d98f99 !important;
      color: #fff !important;
      font-size: 9px !important;
      font-weight: 750 !important;
      text-align: center !important;
    }
    .abags-reference-layout-v3 .abags-builder-actions button {
      min-height: 38px !important;
      border: 1px solid rgba(90,66,69,.12) !important;
      border-radius: 10px !important;
      background: #fff !important;
      color: #5a4245 !important;
      font-size: 9px !important;
    }

    .abags-reference-layout-v3 .abags-vc-preview-column {
      min-width: 0 !important;
      min-height: 0 !important;
      display: grid !important;
      grid-template-rows: minmax(0,1fr) 164px !important;
      gap: 12px !important;
      padding: 16px 18px 14px !important;
      overflow: hidden !important;
      background: #fffaf7 !important;
    }
    .abags-reference-layout-v3 .abags-vc-preview {
      position: relative !important;
      min-width: 0 !important;
      min-height: 0 !important;
      height: auto !important;
      padding: 0 !important;
      overflow: hidden !important;
      border: 1px solid rgba(90,66,69,.10) !important;
      border-radius: 16px !important;
      background:
        radial-gradient(circle at 17% 28%,rgba(218,180,151,.30),transparent 19%),
        linear-gradient(90deg,rgba(241,219,201,.36) 0 23%,transparent 23%),
        linear-gradient(180deg,#f8e8dc 0%,#f7eee8 60%,#ead7c8 100%) !important;
      box-shadow: 0 15px 40px rgba(90,66,69,.07) !important;
    }
    .abags-reference-layout-v3 .abags-vc-preview::before {
      content: "" !important;
      position: absolute !important;
      inset: 0 !important;
      pointer-events: none !important;
      background:
        linear-gradient(90deg,transparent 0 72%,rgba(255,252,248,.52) 72% 73%,transparent 73%),
        radial-gradient(ellipse at 79% 42%,rgba(255,255,255,.48),transparent 25%),
        linear-gradient(0deg,rgba(125,91,67,.12) 0 17%,transparent 17%) !important;
      z-index: 0 !important;
    }
    .abags-reference-layout-v3 .abags-vc-base,
    .abags-reference-layout-v3 .abags-vc-layer,
    .abags-reference-layout-v3 .abags-vc-live-badge,
    .abags-reference-layout-v3 .abags-vc-compare,
    .abags-reference-layout-v3 .abags-vc-empty,
    .abags-reference-layout-v3 .abags-vc-preview-note,
    .abags-reference-layout-v3 .abags-vc-price,
    .abags-reference-layout-v3 .abags-vc-summary {
      display: none !important;
    }
    .abags-reference-layout-v3 .abags-bag-builder-stage {
      position: absolute !important;
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
      min-height: 0 !important;
      z-index: 2 !important;
      border: 0 !important;
      border-radius: 0 !important;
      background: transparent !important;
      box-shadow: none !important;
    }
    .abags-reference-layout-v3 .abags-bag-builder-stage.abags-pro3d-active > svg,
    .abags-reference-layout-v3 .abags-bag-builder-stage.abags-canvas3d-active > svg {
      opacity: 0 !important;
      visibility: hidden !important;
    }

    .abags-reference-layout-v3 .abags-pro3d-chip,
    .abags-reference-layout-v3 .abags-canvas3d-chip {
      top: 14px !important;
      left: 16px !important;
      right: auto !important;
      transform: none !important;
      padding: 7px 10px !important;
      border-radius: 999px !important;
      background: rgba(255,252,249,.93) !important;
      color: #62494f !important;
      font-size: 7px !important;
      letter-spacing: .09em !important;
    }
    .abags-reference-layout-v3 .abags-pro3d-view-controls,
    .abags-reference-layout-v3 .abags-canvas3d-views {
      top: 14px !important;
      right: 14px !important;
      padding: 4px !important;
      border-radius: 999px !important;
      background: rgba(255,252,249,.94) !important;
    }
    .abags-reference-layout-v3 .abags-pro3d-view-controls button,
    .abags-reference-layout-v3 .abags-canvas3d-views button {
      min-width: 48px !important;
      height: 31px !important;
      font-size: 7px !important;
    }
    .abags-reference-layout-v3 .abags-pro3d-zoom,
    .abags-reference-layout-v3 .abags-canvas3d-zoom {
      left: 50% !important;
      right: auto !important;
      bottom: 12px !important;
      width: min(78%,520px) !important;
      transform: translateX(-50%) !important;
      opacity: .88 !important;
    }
    .abags-reference-layout-v3 .abags-pro3d-hint,
    .abags-reference-layout-v3 .abags-canvas3d-hint { display: none !important; }

    .abags-reference-layout-v3 .abags-ref-layers {
      position: absolute !important;
      top: 62px !important;
      right: 18px !important;
      z-index: 260 !important;
      width: 186px !important;
      max-height: calc(100% - 128px) !important;
      padding: 11px !important;
      overflow: auto !important;
      border: 1px solid rgba(90,66,69,.12) !important;
      border-radius: 13px !important;
      background: rgba(255,252,249,.92) !important;
      backdrop-filter: blur(10px) !important;
      box-shadow: 0 12px 32px rgba(90,66,69,.10) !important;
    }
    .abags-reference-layout-v3 .abags-ref-layers-head strong {
      display: block !important;
      font-size: 9px !important;
      text-transform: uppercase !important;
      letter-spacing: .08em !important;
    }
    .abags-reference-layout-v3 .abags-ref-layers-head small {
      display: block !important;
      margin-top: 3px !important;
      color: rgba(90,66,69,.54) !important;
      font-size: 7px !important;
    }
    .abags-reference-layout-v3 .abags-ref-layer-row {
      width: 100% !important;
      display: grid !important;
      grid-template-columns: 10px 1fr auto !important;
      gap: 7px !important;
      align-items: center !important;
      padding: 6px 0 !important;
      border: 0 !important;
      border-bottom: 1px solid rgba(90,66,69,.07) !important;
      background: transparent !important;
      color: #5a4245 !important;
      text-align: left !important;
    }
    .abags-reference-layout-v3 .abags-ref-layer-dot {
      width: 7px !important;
      height: 7px !important;
      border-radius: 50% !important;
      background: #b87880 !important;
    }
    .abags-reference-layout-v3 .abags-ref-layer-row strong { display: block !important; font-size: 7px !important; }
    .abags-reference-layout-v3 .abags-ref-layer-row small { display: block !important; margin-top: 1px !important; font-size: 6.5px !important; color: rgba(90,66,69,.58) !important; }
    .abags-reference-layout-v3 .abags-ref-layer-edit { font-size: 6px !important; color: #a06570 !important; }

    .abags-reference-layout-v3 .abags-ref-inspirations {
      min-width: 0 !important;
      min-height: 0 !important;
      display: grid !important;
      grid-template-rows: auto minmax(0,1fr) !important;
      gap: 7px !important;
      padding: 10px 12px !important;
      border: 1px solid rgba(90,66,69,.10) !important;
      border-radius: 14px !important;
      background: #fffdfb !important;
    }
    .abags-reference-layout-v3 .abags-ref-inspiration-head {
      display: flex !important;
      align-items: end !important;
      justify-content: space-between !important;
      gap: 10px !important;
    }
    .abags-reference-layout-v3 .abags-ref-inspiration-head strong {
      font-size: 9px !important;
      text-transform: uppercase !important;
      letter-spacing: .08em !important;
    }
    .abags-reference-layout-v3 .abags-ref-inspiration-head small {
      color: rgba(90,66,69,.52) !important;
      font-size: 7px !important;
    }
    .abags-reference-layout-v3 .abags-ref-inspiration-track {
      min-width: 0 !important;
      display: grid !important;
      grid-auto-flow: column !important;
      grid-auto-columns: minmax(122px,1fr) !important;
      gap: 8px !important;
      overflow-x: auto !important;
      scrollbar-width: none !important;
    }
    .abags-reference-layout-v3 .abags-ref-inspiration-track::-webkit-scrollbar { display: none !important; }
    .abags-reference-layout-v3 .abags-ref-inspiration-track > button {
      min-width: 0 !important;
      display: grid !important;
      grid-template-rows: minmax(0,1fr) auto !important;
      overflow: hidden !important;
      padding: 0 !important;
      border: 1px solid rgba(90,66,69,.11) !important;
      border-radius: 11px !important;
      background: #fff8f5 !important;
      color: #5a4245 !important;
      text-align: left !important;
    }
    .abags-reference-layout-v3 .abags-ref-photo {
      min-height: 78px !important;
      display: block !important;
      background-repeat: no-repeat !important;
      background-color: #f0e2da !important;
    }
    .abags-reference-layout-v3 .abags-ref-inspiration-copy {
      display: block !important;
      padding: 6px 7px !important;
    }
    .abags-reference-layout-v3 .abags-ref-inspiration-copy strong { display: block !important; font-size: 8px !important; }
    .abags-reference-layout-v3 .abags-ref-inspiration-copy small { display: block !important; margin-top: 2px !important; font-size: 6.5px !important; color: rgba(90,66,69,.52) !important; }

    .abags-reference-layout-v3 > .abags-vc-footer { display: none !important; }
    .abags-reference-layout-v3 > .abags-ref-trust {
      flex: 0 0 42px !important;
      min-height: 42px !important;
      display: grid !important;
      grid-template-columns: repeat(4,1fr) !important;
      align-items: center !important;
      border-top: 1px solid rgba(90,66,69,.10) !important;
      background: #fffaf7 !important;
      color: rgba(90,66,69,.78) !important;
    }
    .abags-reference-layout-v3 > .abags-ref-trust span {
      padding: 0 12px !important;
      text-align: center !important;
      font-size: 7px !important;
    }

    @media (max-width: 900px) {
      .abags-vc-layer-root { padding: 0 !important; align-items: stretch !important; justify-content: stretch !important; }
      .abags-vc-backdrop { display: none !important; }
      .abags-vc-dialog.abags-reference-layout-v3 {
        width: 100vw !important;
        height: 100dvh !important;
        max-width: none !important;
        max-height: none !important;
        border: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
      }
      .abags-reference-layout-v3 .abags-vc-header {
        position: relative !important;
        flex: 0 0 58px !important;
        min-height: 58px !important;
        display: flex !important;
        align-items: center !important;
        padding: 0 58px !important;
        border-bottom: 1px solid rgba(90,66,69,.09) !important;
        background: rgba(255,250,247,.98) !important;
      }
      .abags-reference-layout-v3 .abags-vc-header .eyebrow {
        margin: 0 !important;
        font-size: 8px !important;
        letter-spacing: .11em !important;
        white-space: nowrap !important;
      }
      .abags-reference-layout-v3 .abags-vc-header h2,
      .abags-reference-layout-v3 .abags-v3-subtitle,
      .abags-reference-layout-v3 .abags-v3-wordmark { display: none !important; }
      .abags-reference-layout-v3 .abags-vc-header > button {
        top: 10px !important;
        left: auto !important;
        right: 12px !important;
        width: 38px !important;
        height: 38px !important;
        font-size: 22px !important;
        box-shadow: none !important;
      }
      .abags-reference-layout-v3 .abags-vc-layout {
        display: flex !important;
        flex-direction: column !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        overscroll-behavior: contain !important;
        background: #fffaf7 !important;
      }
      .abags-reference-layout-v3 .abags-vc-preview-column {
        order: 1 !important;
        flex: 0 0 auto !important;
        display: block !important;
        padding: 0 !important;
        overflow: visible !important;
        background: #fffaf7 !important;
      }
      .abags-reference-layout-v3 .abags-vc-preview {
        height: min(43dvh,360px) !important;
        min-height: 315px !important;
        border: 0 !important;
        border-bottom: 1px solid rgba(90,66,69,.08) !important;
        border-radius: 0 !important;
        box-shadow: none !important;
      }
      .abags-reference-layout-v3 .abags-ref-layers { display: none !important; }
      .abags-reference-layout-v3 .abags-pro3d-chip,
      .abags-reference-layout-v3 .abags-canvas3d-chip {
        top: 12px !important;
        left: 11px !important;
        max-width: 48% !important;
        padding: 6px 8px !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
        font-size: 6px !important;
      }
      .abags-reference-layout-v3 .abags-pro3d-view-controls,
      .abags-reference-layout-v3 .abags-canvas3d-views {
        top: 10px !important;
        right: 9px !important;
      }
      .abags-reference-layout-v3 .abags-pro3d-view-controls button,
      .abags-reference-layout-v3 .abags-canvas3d-views button {
        min-width: 43px !important;
        height: 29px !important;
        font-size: 6.5px !important;
      }
      .abags-reference-layout-v3 .abags-pro3d-zoom,
      .abags-reference-layout-v3 .abags-canvas3d-zoom {
        bottom: 8px !important;
        width: calc(100% - 22px) !important;
      }
      .abags-reference-layout-v3 .abags-ref-inspirations {
        height: 118px !important;
        margin: 0 !important;
        padding: 8px 9px 9px !important;
        border: 0 !important;
        border-bottom: 1px solid rgba(90,66,69,.08) !important;
        border-radius: 0 !important;
      }
      .abags-reference-layout-v3 .abags-ref-inspiration-head small { display: none !important; }
      .abags-reference-layout-v3 .abags-ref-inspiration-head strong { font-size: 8px !important; }
      .abags-reference-layout-v3 .abags-ref-inspiration-track {
        grid-auto-columns: 82px !important;
        gap: 6px !important;
      }
      .abags-reference-layout-v3 .abags-ref-photo { min-height: 62px !important; }
      .abags-reference-layout-v3 .abags-ref-inspiration-copy { padding: 4px 5px !important; }
      .abags-reference-layout-v3 .abags-ref-inspiration-copy strong { font-size: 7px !important; }
      .abags-reference-layout-v3 .abags-ref-inspiration-copy small { display: none !important; }

      .abags-reference-layout-v3 .abags-exact-live-mount {
        order: 2 !important;
        flex: 0 0 auto !important;
        display: block !important;
        overflow: visible !important;
        border: 0 !important;
      }
      .abags-reference-layout-v3 .abags-ref-step-rail { display: none !important; }
      .abags-reference-layout-v3 .abags-builder-controls {
        display: block !important;
        padding: 8px 13px 110px !important;
        overflow: visible !important;
        background: #fffdfb !important;
      }
      .abags-reference-layout-v3 .abags-builder-heading { display: none !important; }
      .abags-reference-layout-v3 .abags-builder-group {
        border-bottom: 1px solid rgba(90,66,69,.10) !important;
      }
      .abags-reference-layout-v3 .abags-builder-group legend {
        min-height: 50px !important;
        padding: 11px 2px !important;
      }
      .abags-reference-layout-v3 .abags-builder-group legend > span {
        width: 23px !important;
        height: 23px !important;
        font-size: 8px !important;
      }
      .abags-reference-layout-v3 .abags-builder-group legend::after { font-size: 17px !important; }
      .abags-reference-layout-v3 .abags-builder-group.is-v3-open .abags-builder-options {
        grid-template-columns: repeat(2,minmax(0,1fr)) !important;
        gap: 7px !important;
        padding: 0 0 12px !important;
      }
      .abags-reference-layout-v3 .abags-builder-group[data-v3-key="family"] .abags-builder-options {
        grid-template-columns: repeat(3,minmax(0,1fr)) !important;
      }
      .abags-reference-layout-v3 .abags-builder-group[data-v3-key="family"] .abags-builder-options button {
        min-height: 118px !important;
        flex-direction: column !important;
        align-items: stretch !important;
        gap: 5px !important;
        padding: 6px !important;
      }
      .abags-reference-layout-v3 .abags-ref-family-photo {
        width: 100% !important;
        height: 82px !important;
        flex: 0 0 82px !important;
      }
      .abags-reference-layout-v3 .abags-builder-group[data-v3-key="family"] .abags-builder-option-copy small { display: none !important; }
      .abags-reference-layout-v3 .abags-builder-group[data-v3-key="family"] .abags-builder-option-copy strong {
        text-align: center !important;
        font-size: 8px !important;
      }
      .abags-reference-layout-v3 .abags-builder-group[data-v3-key="color"] .abags-builder-options {
        display: flex !important;
        flex-wrap: nowrap !important;
        overflow-x: auto !important;
        padding-bottom: 12px !important;
      }
      .abags-reference-layout-v3 .abags-builder-group[data-v3-key="stitch"] .abags-builder-options button {
        min-height: 88px !important;
      }
      .abags-reference-layout-v3 .abags-builder-commerce-mount { margin-top: 14px !important; }
      .abags-reference-layout-v3 .abags-builder-actions { margin-bottom: 10px !important; }
      .abags-reference-layout-v3 > .abags-ref-trust { display: none !important; }
      .abags-reference-layout-v3 > .abags-vc-footer { display: none !important; }
    }

    @media (max-width: 390px) {
      .abags-reference-layout-v3 .abags-vc-preview { min-height: 300px !important; height: 40dvh !important; }
      .abags-reference-layout-v3 .abags-builder-group[data-v3-key="family"] .abags-builder-options { grid-template-columns: repeat(2,minmax(0,1fr)) !important; }
      .abags-reference-layout-v3 .abags-ref-inspiration-track { grid-auto-columns: 78px !important; }
    }
  `}</style>;
}
