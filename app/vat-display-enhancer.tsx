"use client";

import { useEffect } from "react";

const VAT_RATE = 23;

function parseMoney(text: string) {
  const normalized = text.replace(/[^0-9,.-]/g, "").replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(value);
}

function enhanceAdminNetPrice() {
  document.querySelectorAll<HTMLElement>(".admin-price-input").forEach((wrapper) => {
    if (wrapper.dataset.vatReady === "true") return;
    const label = wrapper.closest("label");
    const title = label?.querySelector<HTMLElement>(":scope > span");
    const input = wrapper.querySelector<HTMLInputElement>("input");
    if (!label || !title || !input) return;

    title.textContent = "Cena netto";
    wrapper.dataset.vatReady = "true";

    const preview = document.createElement("small");
    preview.className = "admin-vat-preview";
    preview.style.display = "block";
    preview.style.marginTop = ".45rem";
    preview.style.lineHeight = "1.5";
    label.appendChild(preview);

    const update = () => {
      const net = parseMoney(input.value);
      if (net === null || net < 0) {
        preview.textContent = `Sklep automatycznie doliczy VAT ${VAT_RATE}%.`;
        return;
      }
      const gross = Math.round(net * (100 + VAT_RATE)) / 100;
      const vat = Math.round((gross - net) * 100) / 100;
      preview.textContent = `Cena dla klienta: ${formatMoney(gross)} brutto · VAT ${VAT_RATE}%: ${formatMoney(vat)}`;
    };

    input.addEventListener("input", update);
    update();
  });

  document.querySelectorAll<HTMLElement>(".admin-product-row small").forEach((node) => {
    if (node.dataset.vatReady === "true") return;
    const net = parseMoney(node.textContent ?? "");
    if (net === null) return;
    node.dataset.vatReady = "true";
    const gross = Math.round(net * (100 + VAT_RATE)) / 100;
    node.textContent = `${formatMoney(net)} netto · ${formatMoney(gross)} brutto`;
  });
}

function enhanceStorefrontPrices() {
  document.querySelectorAll<HTMLElement>(".product-info").forEach((info) => {
    if (info.dataset.vatReady === "true") return;
    const price = info.querySelector<HTMLElement>(":scope > strong");
    if (!price) return;
    info.dataset.vatReady = "true";
    const note = document.createElement("small");
    note.className = "product-vat-note";
    note.textContent = `cena brutto · zawiera VAT ${VAT_RATE}%`;
    note.style.display = "block";
    note.style.marginTop = ".2rem";
    note.style.fontSize = ".68rem";
    note.style.opacity = ".62";
    price.insertAdjacentElement("afterend", note);
  });
}

function enhance() {
  enhanceAdminNetPrice();
  enhanceStorefrontPrices();
}

export default function VatDisplayEnhancer() {
  useEffect(() => {
    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
