"use client";

import { useEffect, useState } from "react";

type ProductCompliance = {
  id: string;
  number: string;
  name: string;
  productIdentifier: string;
  batchCode: string;
  materials: string;
  careInstructions: string;
  safetyInfo: string;
};

type LegalStatus = {
  vatLabel: string;
  manufacturer: {
    name: string;
    address: string;
    email: string;
  };
};

function setTextIfChanged(node: Element | null, value: string) {
  if (node && node.textContent !== value) node.textContent = value;
}

function findProduct(
  products: ProductCompliance[],
  name: string,
  number?: string,
) {
  const normalizedName = name.trim();
  const normalizedNumber = number?.trim();
  return (
    products.find(
      (product) =>
        product.name === normalizedName &&
        (!normalizedNumber || product.number === normalizedNumber),
    ) ?? products.find((product) => product.name === normalizedName)
  );
}

function addTextRow(container: HTMLElement, label: string, value: string) {
  if (!value.trim()) return;
  const row = document.createElement("p");
  const strong = document.createElement("strong");
  strong.textContent = `${label}: `;
  row.append(strong, document.createTextNode(value.trim()));
  container.append(row);
}

function buildComplianceDetails(product: ProductCompliance, status: LegalStatus) {
  const section = document.createElement("section");
  section.className = "abags-product-compliance";
  section.dataset.productCompliance = product.id;

  const heading = document.createElement("h3");
  heading.textContent = "Informacje o produkcie i bezpieczeństwie";
  section.append(heading);

  addTextRow(section, "Identyfikator produktu", product.productIdentifier);
  addTextRow(section, "Partia / seria", product.batchCode);
  addTextRow(section, "Materiały", product.materials);
  addTextRow(section, "Pielęgnacja", product.careInstructions);
  addTextRow(section, "Informacje bezpieczeństwa", product.safetyInfo);

  const manufacturer = [status.manufacturer.name, status.manufacturer.address]
    .filter(Boolean)
    .join(" · ");
  addTextRow(section, "Producent", manufacturer);
  if (status.manufacturer.email) {
    const contact = document.createElement("p");
    const strong = document.createElement("strong");
    strong.textContent = "Kontakt producenta: ";
    const link = document.createElement("a");
    link.href = `mailto:${status.manufacturer.email}`;
    link.textContent = status.manufacturer.email;
    contact.append(strong, link);
    section.append(contact);
  }

  const safetyLink = document.createElement("a");
  safetyLink.href = "/bezpieczenstwo-produktow";
  safetyLink.textContent = "Pełne informacje o bezpieczeństwie produktów →";
  section.append(safetyLink);

  return section;
}

function enhanceCards(products: ProductCompliance[]) {
  document.querySelectorAll<HTMLElement>(".product-card").forEach((card) => {
    const name = card.querySelector<HTMLElement>(".product-info h3")?.textContent?.trim() ?? "";
    const number = card.querySelector<HTMLElement>(".product-number")?.textContent?.trim() ?? "";
    const product = findProduct(products, name, number);
    if (!product) return;

    card.dataset.productId = product.id;
    if (card.querySelector(`[data-product-compliance-card='${CSS.escape(product.id)}']`)) return;

    const note = document.createElement("div");
    note.className = "product-compliance-card";
    note.dataset.productComplianceCard = product.id;

    const identifier = document.createElement("small");
    identifier.textContent = product.productIdentifier
      ? `Identyfikator: ${product.productIdentifier}`
      : "Dane identyfikacji i bezpieczeństwa są uzupełniane przed uruchomieniem sprzedaży.";
    note.append(identifier);

    const link = document.createElement("a");
    link.href = "/bezpieczenstwo-produktow";
    link.textContent = "Bezpieczeństwo produktu";
    note.append(link);

    card.querySelector(".product-info")?.insertAdjacentElement("afterend", note);
  });
}

function enhancePreview(products: ProductCompliance[], status: LegalStatus) {
  const dialog = document.querySelector<HTMLElement>(".abags-preview-dialog");
  if (!dialog) return;

  const name = dialog.querySelector<HTMLElement>("#abags-preview-title")?.textContent?.trim() ?? "";
  const numberText = dialog.querySelector<HTMLElement>(".abags-preview-number")?.textContent ?? "";
  const number = numberText.replace(/^Model\s+/i, "").trim();
  const product = findProduct(products, name, number);
  if (!product) return;

  setTextIfChanged(dialog.querySelector(".abags-preview-price small"), status.vatLabel);
  setTextIfChanged(dialog.querySelector(".abags-preview-availability strong"), "Ręcznie wykonany model");
  setTextIfChanged(
    dialog.querySelector(".abags-preview-availability span"),
    "Dostępność może być ograniczona ze względu na ręczny proces wykonania.",
  );
  setTextIfChanged(
    dialog.querySelector(".abags-preview-note"),
    "Produkt handmade · bezpieczna płatność Stripe · wysyłka lub odbiór osobisty",
  );

  if (!dialog.querySelector(`[data-product-compliance='${CSS.escape(product.id)}']`)) {
    const copy = dialog.querySelector<HTMLElement>(".abags-preview-copy");
    const actions = dialog.querySelector<HTMLElement>(".abags-preview-actions");
    if (copy) {
      const section = buildComplianceDetails(product, status);
      if (actions) copy.insertBefore(section, actions);
      else copy.append(section);
    }
  }
}

export default function ProductComplianceEnhancer() {
  const [products, setProducts] = useState<ProductCompliance[]>([]);
  const [status, setStatus] = useState<LegalStatus | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/products", { cache: "no-store" }).then(async (response) => {
        if (!response.ok) throw new Error("products unavailable");
        const data = await response.json();
        return Array.isArray(data.products) ? (data.products as ProductCompliance[]) : [];
      }),
      fetch("/api/legal-status", { cache: "no-store" }).then(async (response) => {
        if (!response.ok) throw new Error("legal status unavailable");
        return (await response.json()) as LegalStatus;
      }),
    ])
      .then(([nextProducts, nextStatus]) => {
        if (!active) return;
        setProducts(nextProducts);
        setStatus(nextStatus);
      })
      .catch(() => {
        // Checkout remains fail-closed server-side if compliance data is unavailable.
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!status || products.length === 0) return;

    const enhance = () => {
      enhanceCards(products);
      enhancePreview(products, status);
    };

    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [products, status]);

  return (
    <style>{`
      .product-compliance-card{display:flex;justify-content:space-between;gap:.75rem;align-items:center;margin:.15rem 0 .65rem;padding:.65rem .8rem;border-radius:14px;background:color-mix(in srgb,var(--cream) 72%,transparent);font:500 .68rem/1.45 var(--font-sans)}
      .product-compliance-card small{opacity:.72}.product-compliance-card a{color:var(--ink);font-weight:700;text-underline-offset:3px;white-space:nowrap}
      .abags-product-compliance{margin:0 0 1.25rem;padding:1rem;border:1px solid color-mix(in srgb,var(--ink) 12%,transparent);border-radius:16px;background:color-mix(in srgb,var(--cream) 68%,transparent);font:400 .76rem/1.55 var(--font-sans)}
      .abags-product-compliance h3{font:700 .8rem/1.3 var(--font-sans);margin:0 0 .65rem;color:var(--ink)}
      .abags-product-compliance p{margin:.28rem 0;white-space:pre-wrap}.abags-product-compliance p strong{font-weight:700}.abags-product-compliance>a{display:inline-block;margin-top:.55rem;color:var(--ink);font-weight:700;text-underline-offset:3px}
      @media(max-width:760px){.product-compliance-card{align-items:flex-start;flex-direction:column}.product-compliance-card a{white-space:normal}.abags-product-compliance{margin-bottom:1rem}}
    `}</style>
  );
}
