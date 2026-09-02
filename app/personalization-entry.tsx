"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const PERSONALIZE_LABEL = "Personalizuj torebkę";

function findConfiguratorButton() {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>(".abags-experience-actions > button"),
  ).find((button) => button.textContent?.includes("Stwórz własną torebkę"));
}

function openConfigurator() {
  const button = findConfiguratorButton();
  if (button) {
    button.click();
    return;
  }

  document.getElementById("personalizacja")?.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });

  window.setTimeout(() => findConfiguratorButton()?.click(), 250);
}

function createNavigationLink(container: Element, mobile = false) {
  if (container.querySelector("[data-abags-personalize-link]")) return;

  const link = document.createElement("a");
  link.href = "#personalizacja";
  link.dataset.abagsPersonalizeLink = "true";
  link.className = mobile
    ? "abags-personalize-nav-link abags-personalize-nav-link-mobile"
    : "abags-personalize-nav-link";
  link.textContent = PERSONALIZE_LABEL;
  link.setAttribute("aria-label", "Otwórz konfigurator personalizacji torebki");
  link.addEventListener("click", (event) => {
    event.preventDefault();
    if (mobile) {
      document
        .querySelector<HTMLButtonElement>(".menu-button[aria-expanded='true']")
        ?.click();
    }
    openConfigurator();
  });

  if (mobile) container.insertBefore(link, container.firstChild);
  else container.appendChild(link);
}

export default function PersonalizationEntry() {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const collection = document.getElementById("kolekcja");
    if (!collection?.parentElement) return;

    const mount = document.createElement("div");
    mount.className = "abags-personalization-entry-mount";
    collection.insertAdjacentElement("afterend", mount);
    const frame = window.requestAnimationFrame(() => setHost(mount));

    const enhanceNavigation = () => {
      const desktop = document.querySelector(".desktop-navigation");
      if (desktop) createNavigationLink(desktop);

      const mobile = document.getElementById("mobile-navigation");
      if (mobile) createNavigationLink(mobile, true);
    };

    enhanceNavigation();
    const observer = new MutationObserver(enhanceNavigation);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      document
        .querySelectorAll("[data-abags-personalize-link]")
        .forEach((link) => link.remove());
      mount.remove();
    };
  }, []);

  if (!host) return null;

  return createPortal(
    <section
      className="abags-personalization-entry"
      id="personalizacja"
      aria-labelledby="abags-personalization-title"
    >
      <div className="abags-personalization-copy">
        <p className="eyebrow">A-Bags Atelier · Twoja wersja</p>
        <h2 id="abags-personalization-title">Stwórz torebkę dokładnie po swojemu.</h2>
        <p>
          Wybierz model bazowy, kolor, splot lub ścieg, rodzaj uchwytów i detal.
          Gotową konfigurację wyślesz bezpośrednio do pracowni, a przed realizacją
          potwierdzimy możliwość wykonania, cenę i termin.
        </p>
        <button type="button" onClick={openConfigurator}>
          Personalizuj torebkę <span aria-hidden="true">→</span>
        </button>
      </div>

      <div className="abags-personalization-options" aria-label="Możliwości personalizacji">
        <span><strong>01</strong> Model bazowy</span>
        <span><strong>02</strong> Kolor</span>
        <span><strong>03</strong> Splot / ścieg</span>
        <span><strong>04</strong> Uchwyty</span>
        <span><strong>05</strong> Detal</span>
      </div>
    </section>,
    host,
  );
}
