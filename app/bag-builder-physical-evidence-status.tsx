"use client";

import { useEffect } from "react";
import { useBagBuilderClientConfig } from "./bag-builder-config-store";

type EvidenceOption = {
  family: string;
  stitch: string;
  color: string;
  status: "BODY_VALIDATED";
  binding: {
    cordMaterialId: string;
    gaugeProfileId: string;
    goldenMasterId: string;
  };
  material: {
    supplier: string;
    supplierSku: string;
    name: string;
    nominalDiameterMm: number;
    measuredDiameterMm: number;
  };
  body: {
    baseProductId: string | null;
    widthMm: number;
    heightMm: number;
    depthMm: number;
  };
};

type EvidenceResponse = {
  level?: "BODY_ONLY";
  fullProductStatus?: "NOT_VALIDATED";
  sellable1to1?: false;
  options?: EvidenceOption[];
};

function ensureCard(controls: HTMLElement) {
  let card = controls.querySelector<HTMLElement>("[data-builder-physical-evidence]");
  if (card) return card;
  card = document.createElement("div");
  card.className = "abags-builder-summary";
  card.dataset.builderPhysicalEvidence = "true";
  card.setAttribute("role", "status");
  card.setAttribute("aria-live", "polite");
  const validation = controls.querySelector<HTMLElement>("[data-builder-validation-status]");
  if (validation) validation.insertAdjacentElement("afterend", card);
  else controls.querySelector(".abags-builder-actions")?.insertAdjacentElement("beforebegin", card);
  return card;
}

function renderCard(card: HTMLElement, titleText: string, copyText: string, noteText: string) {
  const heading = document.createElement("strong");
  const copy = document.createElement("p");
  const note = document.createElement("small");
  heading.textContent = titleText;
  copy.textContent = copyText;
  note.textContent = noteText;
  card.replaceChildren(heading, copy, note);
}

function cm(valueMm: number) {
  return `${(valueMm / 10).toFixed(1).replace(".", ",")} cm`;
}

export default function BagBuilderPhysicalEvidenceStatus() {
  const config = useBagBuilderClientConfig();

  useEffect(() => {
    const controls = document.querySelector<HTMLElement>(".abags-builder-controls");
    if (!controls) return;

    const card = ensureCard(controls);
    if (!config.family || !config.stitch || !config.color) {
      renderCard(
        card,
        "Status fizycznego wzorca",
        "Wybierz fason, kolor sznurka i ścieg, aby sprawdzić pokrycie Digital Craft Twin.",
        "Status dotyczy wyłącznie zwalidowanych fizycznie danych korpusu.",
      );
      return;
    }

    const controller = new AbortController();
    renderCard(
      card,
      "Sprawdzam fizyczny wzorzec…",
      "Porównuję fason, ścieg i kolor z zatwierdzonym materiałem, Gauge i Golden Masterem.",
      "Pełna torebka wymaga osobnej walidacji akcesoriów i mocowań.",
    );

    const params = new URLSearchParams({
      family: config.family,
      stitch: config.stitch,
      color: config.color,
    });

    void fetch(`/api/configurator/evidence?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json() as EvidenceResponse & { error?: string };
        if (!response.ok) throw new Error(payload.error || "Nie udało się sprawdzić fizycznego wzorca.");
        return Array.isArray(payload.options) ? payload.options : [];
      })
      .then((options) => {
        if (controller.signal.aborted) return;
        if (options.length === 0) {
          renderCard(
            card,
            "Digital Craft Twin · NOT_VALIDATED",
            "Dla tego dokładnego połączenia fasonu, ściegu i koloru nie ma jeszcze kompletnego zatwierdzonego wzorca korpusu.",
            "To nie jest ocena wyglądu podglądu. Brakuje pełnego łańcucha fizycznych danych materiał → Gauge → Golden Master → kolor SKU.",
          );
          return;
        }

        if (options.length > 1) {
          renderCard(
            card,
            `Korpus · ${options.length} zwalidowane wzorce`,
            "Istnieje więcej niż jeden fizycznie potwierdzony binding dla tych wyborów. System nie wybiera żadnego automatycznie.",
            "Status BODY_VALIDATED obejmuje tylko korpus; akcesoria i mocowania nadal mają status NOT_VALIDATED.",
          );
          return;
        }

        const option = options[0];
        renderCard(
          card,
          "Korpus · BODY_VALIDATED ✓",
          `${option.material.name} · ${option.material.supplier} · SKU ${option.material.supplierSku} · średnica zmierzona ${option.material.measuredDiameterMm} mm. Wzorzec: ${cm(option.body.widthMm)} × ${cm(option.body.heightMm)} × ${cm(option.body.depthMm)}.`,
          "Potwierdzony jest wyłącznie korpus dla tego fasonu, ściegu i koloru. Pełna torebka nadal wymaga walidacji akcesoriów i mocowań.",
        );
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        renderCard(
          card,
          "Status fizycznego wzorca niedostępny",
          error instanceof Error ? error.message : "Nie udało się sprawdzić fizycznego wzorca.",
          "Brak odczytu dowodu nie jest traktowany jako potwierdzenie 1:1.",
        );
      });

    return () => controller.abort();
  }, [config.color, config.family, config.stitch]);

  useEffect(() => () => {
    document.querySelector("[data-builder-physical-evidence]")?.remove();
  }, []);

  return null;
}
