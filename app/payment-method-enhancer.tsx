"use client";

import { useEffect } from "react";

type PaymentChoice = "blik" | "card" | "wallet";

const labels: Record<string, PaymentChoice> = {
  BLIK: "blik",
  Karta: "card",
  "Portfel mobilny": "wallet",
};

function setPaymentCookie(value: PaymentChoice) {
  document.cookie = `abags-payment-method=${value}; Path=/; Max-Age=3600; SameSite=Lax`;
}

function enhancePaymentOptions() {
  const container = document.querySelector<HTMLElement>(".payment-options");
  if (!container || container.dataset.enhanced === "true") return;

  const options = Array.from(container.querySelectorAll<HTMLElement>(":scope > span"));
  if (options.length === 0) return;

  container.dataset.enhanced = "true";
  container.setAttribute("role", "radiogroup");

  const select = (selected: HTMLElement) => {
    options.forEach((option) => {
      const active = option === selected;
      option.setAttribute("aria-checked", active ? "true" : "false");
      option.tabIndex = active ? 0 : -1;
      option.classList.toggle("payment-primary", active);
    });

    const choice = labels[selected.textContent?.trim() ?? ""];
    if (choice) setPaymentCookie(choice);
  };

  options.forEach((option, index) => {
    option.setAttribute("role", "radio");
    option.style.cursor = "pointer";
    option.style.userSelect = "none";
    option.tabIndex = index === 0 ? 0 : -1;
    option.setAttribute("aria-checked", index === 0 ? "true" : "false");

    option.addEventListener("click", () => select(option));
    option.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        select(option);
      }

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        const next = options[(options.indexOf(option) + 1) % options.length];
        select(next);
        next.focus();
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        const next = options[
          (options.indexOf(option) - 1 + options.length) % options.length
        ];
        select(next);
        next.focus();
      }
    });
  });

  select(options[0]);
}

export default function PaymentMethodEnhancer() {
  useEffect(() => {
    enhancePaymentOptions();

    const observer = new MutationObserver(() => enhancePaymentOptions());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
