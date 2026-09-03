"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePublicContact, whatsappHref } from "../../public-contact";

type Confirmation = {
  id: string;
  paymentStatus: "paid" | "unpaid" | "no_payment_required";
  status: string | null;
  amountTotal: number | null;
  currency: string | null;
  email: string | null;
  builderProjectCode: string | null;
  builderProjectReference: string | null;
};

type PageState =
  | { kind: "loading" }
  | { kind: "success"; confirmation: Confirmation }
  | { kind: "processing"; confirmation: Confirmation }
  | { kind: "error"; message: string };

const formatter = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
});

const orderQuestion =
  "Dzień dobry! Mam pytanie dotyczące mojego zamówienia w a_bags.handmade.";

function ReturnActions({ whatsappUrl }: { whatsappUrl: string }) {
  return (
    <div className="confirmation-return-actions">
      <Link className="primary-button" href="/#kolekcja">
        Wróć do kolekcji <span aria-hidden="true">→</span>
      </Link>
      <a
        className="confirmation-secondary-link"
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        Napisz do nas na WhatsApp
      </a>
    </div>
  );
}

export default function OrderSuccessPage() {
  const contact = usePublicContact();
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const orderWhatsappUrl = whatsappHref(contact.whatsappNumber, orderQuestion);

  useEffect(() => {
    const checkPayment = async () => {
      try {
        const sessionId = new URLSearchParams(window.location.search).get("session_id");
        if (!sessionId) throw new Error("Brakuje numeru potwierdzenia płatności.");
        const response = await fetch(
          `/api/checkout/session?session_id=${encodeURIComponent(sessionId)}`,
          { cache: "no-store" },
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Nie udało się sprawdzić płatności.");
        const confirmation = data as Confirmation;
        if (
          confirmation.paymentStatus === "paid" ||
          confirmation.paymentStatus === "no_payment_required"
        ) {
          window.localStorage.removeItem("abags-cart");
          if (confirmation.builderProjectCode) {
            window.localStorage.removeItem("abags-bag-builder-v3");
          }
          setState({ kind: "success", confirmation });
        } else {
          setState({ kind: "processing", confirmation });
        }
      } catch (error) {
        setState({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "Nie udało się sprawdzić płatności.",
        });
      }
    };
    void checkPayment();
  }, []);

  return (
    <main className="confirmation-page premium-confirmation-page">
      <style>{`
        .premium-confirmation-page{padding:clamp(1rem,4vw,3rem);background:radial-gradient(circle at 20% 10%,rgba(218,165,173,.18),transparent 32%),var(--paper,#fbf6f2)}
        .premium-confirmation-page .confirmation-card{width:min(820px,100%);padding:clamp(1.4rem,5vw,3.3rem);border-radius:30px;box-shadow:0 28px 90px rgba(49,30,36,.12)}
        .confirmation-return-actions{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;width:100%;margin-top:1.25rem}
        .confirmation-secondary-link{display:inline-flex;justify-content:center;align-items:center;min-height:50px;padding:.75rem 1rem;border:1px solid color-mix(in srgb,var(--ink) 18%,transparent);border-radius:999px;color:var(--ink);font:700 .78rem/1.2 var(--font-sans);text-decoration:none}
        .confirmation-home-hint{margin:.8rem 0 0;font-size:.76rem;opacity:.66}
        .confirmation-wordmark{cursor:pointer}
        .confirmation-intro{max-width:650px;margin:0 auto 1.3rem;font:400 .92rem/1.7 var(--font-sans);opacity:.76}
        .confirmation-project{width:100%;margin:1.1rem 0 0;padding:1.1rem 1.2rem;border-radius:20px;text-align:left;background:color-mix(in srgb,var(--cream,#fff4ef) 80%,white);border:1px solid color-mix(in srgb,var(--rose-deep,#9b6670) 14%,transparent)}
        .confirmation-project span{display:block;margin-bottom:.4rem;font:700 .66rem/1 var(--font-sans);letter-spacing:.12em;text-transform:uppercase;color:var(--rose-deep,#9b6670)}
        .confirmation-project strong{font-family:var(--font-display);font-size:1.28rem;font-weight:500}
        .confirmation-project p{margin:.55rem 0 0;font:400 .76rem/1.55 var(--font-sans);opacity:.72;overflow-wrap:anywhere}
        .confirmation-journey{display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;width:100%;margin:1.35rem 0 0;text-align:left}
        .confirmation-journey article{padding:1rem;border-radius:18px;background:color-mix(in srgb,var(--cream,#fff4ef) 72%,white);border:1px solid color-mix(in srgb,var(--ink) 8%,transparent)}
        .confirmation-journey span{font:700 .62rem/1 var(--font-sans);letter-spacing:.12em;color:var(--rose-deep,#9b6670)}
        .confirmation-journey strong{display:block;margin:.6rem 0 .3rem;font-family:var(--font-display);font-size:1.25rem;font-weight:500}
        .confirmation-journey p{margin:0;font:400 .74rem/1.5 var(--font-sans);opacity:.68}
        .confirmation-social{display:flex;justify-content:center;gap:.7rem;flex-wrap:wrap;margin:1.25rem 0 0}
        .confirmation-social a{min-height:42px;display:inline-flex;align-items:center;padding:.6rem .85rem;border-radius:999px;background:var(--cream,#fff4ef);color:var(--ink);font:700 .7rem/1 var(--font-sans);text-decoration:none}
        @media(max-width:620px){.confirmation-return-actions{grid-template-columns:1fr}.confirmation-journey{grid-template-columns:1fr}.premium-confirmation-page .confirmation-card{border-radius:24px}}
      `}</style>

      <Link
        className="wordmark confirmation-wordmark"
        href="/"
        aria-label="a_bags.handmade — wróć na stronę główną"
      >
        <span>a_bags</span>
        <small>handmade</small>
      </Link>

      <section className="confirmation-card" aria-live="polite">
        {state.kind === "loading" && (
          <>
            <span className="confirmation-mark loading-mark" aria-hidden="true">···</span>
            <p className="eyebrow">Sprawdzamy płatność</p>
            <h1>Jeszcze chwila…</h1>
            <p className="confirmation-intro">
              Bezpiecznie potwierdzamy status zamówienia w Stripe.
            </p>
          </>
        )}

        {state.kind === "success" && (
          <>
            <span className="confirmation-mark" aria-hidden="true">✓</span>
            <p className="eyebrow">Płatność potwierdzona</p>
            <h1>Twoja A-Bags jest coraz bliżej Ciebie. ♡</h1>
            <p className="confirmation-intro">
              Dziękujemy za zamówienie. Potwierdzenie trafi na adres <strong>{state.confirmation.email}</strong>.
              Teraz pracownia przejmuje dalszą realizację.
            </p>

            <div className="confirmation-details">
              <span>
                Zamówienie <strong>#{state.confirmation.id.slice(-8).toUpperCase()}</strong>
              </span>
              {state.confirmation.amountTotal !== null && (
                <span>
                  Zapłacono <strong>{formatter.format(state.confirmation.amountTotal / 100)}</strong>
                </span>
              )}
            </div>

            {state.confirmation.builderProjectCode && (
              <div className="confirmation-project" aria-label="Potwierdzenie personalizowanego projektu">
                <span>Twój projekt A-Bags</span>
                <strong>{state.confirmation.builderProjectCode}</strong>
                {state.confirmation.builderProjectReference && <p>{state.confirmation.builderProjectReference}</p>}
              </div>
            )}

            <div className="confirmation-journey" aria-label="Co wydarzy się dalej">
              <article><span>01</span><strong>Potwierdzenie</strong><p>Otrzymasz wiadomość e-mail z informacją o zamówieniu.</p></article>
              <article><span>02</span><strong>Przygotowanie</strong><p>{state.confirmation.builderProjectCode ? "Twój projekt trafia do realizacji zgodnie z zapisaną konfiguracją." : "Model przechodzi do realizacji i kontroli przed wysyłką."}</p></article>
              <article><span>03</span><strong>Wysyłka</strong><p>Po nadaniu przesyłki otrzymasz dalsze informacje.</p></article>
            </div>

            <ReturnActions whatsappUrl={orderWhatsappUrl} />
            <div className="confirmation-social" aria-label="A-Bags w social media">
              <a href={contact.instagramUrl} target="_blank" rel="noopener noreferrer">Instagram ↗</a>
              <a href={contact.facebookUrl} target="_blank" rel="noopener noreferrer">Facebook ↗</a>
            </div>
            <p className="confirmation-home-hint">{state.confirmation.builderProjectCode ? `Zachowaj kod ${state.confirmation.builderProjectCode} i numer zamówienia na wypadek kontaktu z pracownią.` : "Zachowaj numer zamówienia na wypadek kontaktu z pracownią."}</p>
          </>
        )}

        {state.kind === "processing" && (
          <>
            <span className="confirmation-mark loading-mark" aria-hidden="true">○</span>
            <p className="eyebrow">Płatność w toku</p>
            <h1>Czekamy na potwierdzenie.</h1>
            <p className="confirmation-intro">
              Bank lub Stripe nadal przetwarza płatność. Nie składaj ponownie zamówienia — o wyniku otrzymasz wiadomość e-mail.
            </p>
            <ReturnActions whatsappUrl={orderWhatsappUrl} />
          </>
        )}

        {state.kind === "error" && (
          <>
            <span className="confirmation-mark error-mark" aria-hidden="true">!</span>
            <p className="eyebrow">Nie udało się potwierdzić</p>
            <h1>Sprawdźmy to ponownie.</h1>
            <p className="confirmation-intro">
              {state.message} Jeśli środki zostały pobrane, skontaktuj się ze sklepem.
            </p>
            <ReturnActions whatsappUrl={orderWhatsappUrl} />
          </>
        )}
      </section>

      <p className="confirmation-security">
        Bezpieczna płatność obsługiwana przez Stripe · BLIK · karta
      </p>
    </main>
  );
}
