"use client";

import { useEffect } from "react";

type VatMode = "active_23" | "exempt" | "unknown";

type LegalStatus = {
  vatMode: VatMode;
  vatLabel: string;
};

const VAT_RATE = 23;

function parseMoney(text: string) {
  const normalized = text.replace(/[^0-9,.-]/g, "").replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
  }).format(value);
}

function setTextIfChanged(node: HTMLElement, value: string) {
  if (node.textContent !== value) node.textContent = value;
}

function enhanceAdminPrice(vatMode: VatMode) {
  document.querySelectorAll<HTMLElement>(".admin-price-input").forEach((wrapper) => {
    const label = wrapper.closest("label");
    const title = label?.querySelector<HTMLElement>(":scope > span");
    const input = wrapper.querySelector<HTMLInputElement>("input");
    if (!label || !title || !input) return;

    const titleText =
      vatMode === "active_23"
        ? "Cena netto"
        : vatMode === "exempt"
          ? "Cena dla klienta"
          : "Cena bazowa";
    setTextIfChanged(title, titleText);

    let preview = label.querySelector<HTMLElement>(".admin-vat-preview");
    if (!preview) {
      preview = document.createElement("small");
      preview.className = "admin-vat-preview";
      preview.style.display = "block";
      preview.style.marginTop = ".45rem";
      preview.style.lineHeight = "1.5";
      label.appendChild(preview);
    }

    const update = () => {
      const base = parseMoney(input.value);
      if (base === null || base < 0) {
        setTextIfChanged(preview!, "Wpisz prawidłową kwotę.");
        return;
      }

      if (vatMode === "active_23") {
        const gross = Math.round(base * (100 + VAT_RATE)) / 100;
        const vat = Math.round((gross - base) * 100) / 100;
        setTextIfChanged(
          preview!,
          `Cena dla klienta: ${formatMoney(gross)} brutto · VAT ${VAT_RATE}%: ${formatMoney(vat)}`,
        );
        return;
      }

      if (vatMode === "exempt") {
        setTextIfChanged(
          preview!,
          `Cena dla klienta: ${formatMoney(base)} · VAT nie jest doliczany zgodnie ze skonfigurowanym statusem zwolnienia.`,
        );
        return;
      }

      setTextIfChanged(
        preview!,
        "Status VAT nie został potwierdzony. Checkout pozostaje zablokowany do czasu konfiguracji LEGAL_VAT_MODE.",
      );
    };

    if (wrapper.dataset.vatListenerReady !== "true") {
      input.addEventListener("input", update);
      wrapper.dataset.vatListenerReady = "true";
    }
    update();
  });

  document.querySelectorAll<HTMLElement>(".admin-product-row small").forEach((node) => {
    if (node.dataset.vatReady === vatMode) return;
    const base = parseMoney(node.textContent ?? "");
    if (base === null) return;
    node.dataset.vatReady = vatMode;

    if (vatMode === "active_23") {
      const gross = Math.round(base * (100 + VAT_RATE)) / 100;
      setTextIfChanged(node, `${formatMoney(base)} netto · ${formatMoney(gross)} brutto`);
    } else if (vatMode === "exempt") {
      setTextIfChanged(node, `${formatMoney(base)} · cena dla klienta (bez doliczania VAT)`);
    } else {
      setTextIfChanged(node, `${formatMoney(base)} · status VAT do konfiguracji`);
    }
  });
}

function enhanceStorefrontPrices(status: LegalStatus) {
  document.querySelectorAll<HTMLElement>(".product-info").forEach((info) => {
    const price = info.querySelector<HTMLElement>(":scope > strong");
    if (!price) return;

    let note = info.querySelector<HTMLElement>(".product-vat-note");
    if (!note) {
      note = document.createElement("small");
      note.className = "product-vat-note";
      note.style.display = "block";
      note.style.marginTop = ".2rem";
      note.style.fontSize = ".68rem";
      note.style.opacity = ".62";
      price.insertAdjacentElement("afterend", note);
    }
    setTextIfChanged(note, status.vatLabel);
  });
}

export default function VatDisplayEnhancer() {
  useEffect(() => {
    let active = true;
    let observer: MutationObserver | null = null;

    fetch("/api/legal-status", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("VAT status unavailable");
        return (await response.json()) as LegalStatus;
      })
      .then((status) => {
        if (!active) return;
        const enhance = () => {
          enhanceAdminPrice(status.vatMode);
          enhanceStorefrontPrices(status);
        };
        enhance();
        observer = new MutationObserver(enhance);
        observer.observe(document.body, { childList: true, subtree: true });
      })
      .catch(() => {
        // The checkout legal gate fails closed when legal configuration is missing.
      });

    return () => {
      active = false;
      observer?.disconnect();
    };
  }, []);

  return null;
}
