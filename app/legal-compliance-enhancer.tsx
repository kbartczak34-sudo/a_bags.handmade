"use client";

import { useEffect, useState } from "react";

type LegalStatus = {
  brand: string;
  businessMode: "jdg" | "unregistered" | "unknown";
  vatMode: "active_23" | "exempt" | "unknown";
  vatLabel: string;
  shippingAmount: number;
  seller: {
    legalName: string;
    address: string;
    email: string;
    phone: string;
    nip: string;
    regon: string;
    returnsAddress: string;
  };
  manufacturer: {
    name: string;
    address: string;
    email: string;
  };
  launchReady: boolean;
  readinessIssues: string[];
};

type PrivacyChoice = "undecided" | "essential" | "external";

const money = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
});

function parseMoney(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value
    .replace(/\s/g, "")
    .replace(/[^0-9,.-]/g, "")
    .replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function findSummaryRow(container: Element, label: string) {
  return Array.from(container.querySelectorAll<HTMLElement>(":scope > div")).find(
    (row) => row.querySelector("span, strong")?.textContent?.trim() === label,
  );
}

function patchShipping(container: Element, shippingAmount: number) {
  const productRow = findSummaryRow(container, "Produkty");
  const deliveryRow = findSummaryRow(container, "Dostawa");
  const totalRow =
    findSummaryRow(container, "Razem") ?? findSummaryRow(container, "Do zapłaty");
  if (!productRow || !deliveryRow || !totalRow) return;

  const productValue = productRow.querySelector<HTMLElement>(":scope > :last-child");
  const deliveryValue = deliveryRow.querySelector<HTMLElement>(":scope > :last-child");
  const totalValue = totalRow.querySelector<HTMLElement>(":scope > :last-child");
  const subtotal = parseMoney(productValue?.textContent);
  if (subtotal === null || !deliveryValue || !totalValue) return;

  const delivery = subtotal > 0 ? shippingAmount / 100 : 0;
  const expectedDelivery = delivery === 0 ? "bezpłatnie" : money.format(delivery);
  const expectedTotal = money.format(subtotal + delivery);

  if (deliveryValue.textContent !== expectedDelivery) {
    deliveryValue.textContent = expectedDelivery;
  }
  if (totalValue.textContent !== expectedTotal) {
    totalValue.textContent = expectedTotal;
  }
}

function createLink(href: string, text: string) {
  const link = document.createElement("a");
  link.href = href;
  link.textContent = text;
  return link;
}

function blockInstagramEmbed() {
  document
    .querySelectorAll<HTMLScriptElement>('script[src*="instagram.com/embed.js"]')
    .forEach((script) => script.remove());

  document.querySelectorAll<HTMLElement>(".instagram-embed-shell").forEach((shell) => {
    if (shell.dataset.externalBlocked === "true") return;
    shell.dataset.externalBlocked = "true";
    const profile =
      shell.querySelector<HTMLAnchorElement>("a")?.href ||
      "https://www.instagram.com/a_bags.handmade/";
    shell.replaceChildren();

    const placeholder = document.createElement("div");
    placeholder.className = "external-content-placeholder";
    const copy = document.createElement("p");
    copy.textContent =
      "Treści z Instagrama są wyłączone do czasu zezwolenia na zewnętrzne treści. ";
    const link = document.createElement("a");
    link.href = profile;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "Otwórz profil bezpośrednio ↗";
    copy.append(link);
    placeholder.append(copy);
    shell.append(placeholder);
  });
}

function enhanceProductCards(status: LegalStatus) {
  document.querySelectorAll<HTMLElement>(".product-card").forEach((card) => {
    if (card.querySelector("[data-product-legal-info]")) return;

    const name = card.querySelector("h3")?.textContent?.trim() || "Produkt";
    const model = card.querySelector(".product-number")?.textContent?.trim() || "—";
    const info = document.createElement("div");
    info.className = "product-legal-info";
    info.dataset.productLegalInfo = "true";

    const manufacturer = status.manufacturer.name || "dane producenta do uzupełnienia";
    info.append(
      document.createTextNode(`Producent: ${manufacturer} · Model: ${model} / ${name} · `),
      createLink("/bezpieczenstwo-produktow", "Bezpieczeństwo produktu / GPSR"),
    );
    card.append(info);
  });
}

function enhanceReviews() {
  document
    .querySelectorAll<HTMLElement>(".testimonial-grid article small")
    .forEach((label) => {
      if (label.textContent?.trim() === "opinia klientki") {
        label.textContent = "opinia użytkowniczki · zakup nieweryfikowany";
      }
    });

  const testimonials = document.querySelector<HTMLElement>(".testimonials");
  const grid = testimonials?.querySelector<HTMLElement>(".testimonial-grid");
  if (!testimonials || !grid || testimonials.querySelector("[data-review-verification-note]")) {
    return;
  }

  const note = document.createElement("p");
  note.className = "review-verification-note";
  note.dataset.reviewVerificationNote = "true";
  note.append(
    document.createTextNode(
      "Opinie z publicznego formularza nie są obecnie weryfikowane na podstawie numeru zamówienia. Są moderowane przed publikacją. ",
    ),
    createLink("/regulamin", "Zasady publikacji opinii"),
  );
  grid.insertAdjacentElement("beforebegin", note);
}

function enhanceCheckout(status: LegalStatus) {
  document.querySelectorAll<HTMLFormElement>(".checkout-content form").forEach((form) => {
    const payButton = form.querySelector<HTMLButtonElement>(".pay-button");
    if (!payButton) return;

    if (!form.querySelector("[data-legal-checkout-box]")) {
      const box = document.createElement("div");
      box.className = "legal-checkout-box";
      box.dataset.legalCheckoutBox = "true";

      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.name = "legal_terms_acknowledged";
      checkbox.required = true;
      const text = document.createElement("span");
      text.append(
        document.createTextNode("Zapoznałam/em się z "),
        createLink("/regulamin", "Regulaminem"),
        document.createTextNode(" oraz informacją o "),
        createLink("/zwroty-i-reklamacje", "prawie odstąpienia, zwrotach i reklamacjach"),
        document.createTextNode("."),
      );
      label.append(checkbox, text);

      const privacy = document.createElement("p");
      privacy.append(
        document.createTextNode("Dane użyte do realizacji zamówienia są przetwarzane zgodnie z "),
        createLink("/polityka-prywatnosci", "Polityką prywatności"),
        document.createTextNode(". Zgoda marketingowa nie jest warunkiem zakupu."),
      );

      const identity = document.createElement("p");
      identity.innerHTML = `<strong>Sprzedawca:</strong> ${status.seller.legalName || "dane wymagają uzupełnienia"}${status.seller.nip ? ` · NIP ${status.seller.nip}` : ""}`;

      box.append(label, privacy, identity);
      payButton.insertAdjacentElement("beforebegin", box);
    }

    if (!status.launchReady) {
      payButton.disabled = true;
      payButton.setAttribute("aria-disabled", "true");
      payButton.dataset.legalBlocked = "true";

      if (!form.querySelector("[data-legal-launch-block]")) {
        const block = document.createElement("p");
        block.className = "legal-launch-block";
        block.dataset.legalLaunchBlock = "true";
        block.textContent =
          "Sprzedaż jest wstrzymana do czasu uzupełnienia zweryfikowanych danych sprzedawcy, producenta i statusu VAT.";
        payButton.insertAdjacentElement("beforebegin", block);
      }
    }
  });
}

function enhanceFooter(status: LegalStatus, openPrivacySettings: () => void) {
  const footer = document.querySelector<HTMLElement>("footer#kontakt");
  if (!footer || footer.querySelector("[data-legal-footer]")) return;

  const nav = document.createElement("nav");
  nav.className = "legal-footer-nav";
  nav.dataset.legalFooter = "true";
  nav.setAttribute("aria-label", "Informacje prawne");
  nav.append(
    createLink("/regulamin", "Regulamin"),
    createLink("/polityka-prywatnosci", "Prywatność"),
    createLink("/cookies", "Cookies"),
    createLink("/zwroty-i-reklamacje", "Zwroty i reklamacje"),
    createLink("/bezpieczenstwo-produktow", "Bezpieczeństwo produktów"),
  );

  const privacyButton = document.createElement("button");
  privacyButton.type = "button";
  privacyButton.textContent = "Ustawienia prywatności";
  privacyButton.addEventListener("click", openPrivacySettings);
  nav.append(privacyButton);

  if (status.seller.legalName) {
    const identity = document.createElement("span");
    identity.textContent = `Sprzedawca: ${status.seller.legalName}${status.seller.nip ? ` · NIP ${status.seller.nip}` : ""}`;
    nav.append(identity);
  }

  const footerBottom = footer.querySelector(".footer-bottom");
  if (footerBottom) footerBottom.insertAdjacentElement("beforebegin", nav);
  else footer.append(nav);
}

export default function LegalComplianceEnhancer() {
  const [status, setStatus] = useState<LegalStatus | null>(null);
  const [privacyChoice, setPrivacyChoice] = useState<PrivacyChoice>("undecided");

  useEffect(() => {
    const stored = window.localStorage.getItem("abags-external-content");
    setPrivacyChoice(stored === "accepted" ? "external" : stored === "rejected" ? "essential" : "undecided");
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/legal-status", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("legal status unavailable");
        return (await response.json()) as LegalStatus;
      })
      .then((data) => {
        if (active) setStatus(data);
      })
      .catch(() => {
        // Fail closed: checkout remains governed by the server-side legal gate.
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (privacyChoice !== "external") blockInstagramEmbed();
  }, [privacyChoice]);

  useEffect(() => {
    if (!status) return;

    const openPrivacySettings = () => {
      window.localStorage.removeItem("abags-external-content");
      setPrivacyChoice("undecided");
    };

    const enhance = () => {
      document.querySelectorAll(".shipping-progress").forEach((node) => node.remove());
      document
        .querySelectorAll(".cart-summary, .checkout-totals")
        .forEach((container) => patchShipping(container, status.shippingAmount));
      enhanceProductCards(status);
      enhanceReviews();
      enhanceCheckout(status);
      enhanceFooter(status, openPrivacySettings);
      if (privacyChoice !== "external") blockInstagramEmbed();
    };

    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [status, privacyChoice]);

  const chooseEssential = () => {
    window.localStorage.setItem("abags-external-content", "rejected");
    setPrivacyChoice("essential");
  };

  const chooseExternal = () => {
    window.localStorage.setItem("abags-external-content", "accepted");
    setPrivacyChoice("external");
    window.location.reload();
  };

  if (privacyChoice !== "undecided") return null;

  return (
    <aside className="privacy-banner" role="dialog" aria-label="Ustawienia prywatności">
      <strong>Prywatność i treści zewnętrzne</strong>
      <p>
        Koszyk i wybór płatności korzystają z mechanizmów niezbędnych do działania sklepu. Osadzone treści z Instagrama są opcjonalne i mogą łączyć się z serwisem Meta. Szczegóły: <a href="/cookies">polityka cookies</a>.
      </p>
      <div className="privacy-actions">
        <button type="button" onClick={chooseEssential}>Tylko niezbędne</button>
        <button type="button" onClick={chooseExternal}>Zezwól na Instagram</button>
      </div>
    </aside>
  );
}
