import { getPublicLegalConfig } from "./legal-config";
import { getRuntimeBindings } from "./runtime-env";
import type { CustomerCaseType, NewCustomerCase } from "./customer-cases";

const STORE_URL = "https://abagshandmade.pl";

type ConfirmationInput = {
  id: string;
  type: CustomerCaseType;
  email: string;
  customerName: string;
  orderReference: string;
  productName: string;
  requestedResolution: string;
  createdAt: string;
  responseDueAt: string | null;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Warsaw",
  }).format(new Date(value));
}

function typeLabel(type: CustomerCaseType) {
  return type === "complaint" ? "reklamacja" : "odstąpienie od umowy";
}

export async function sendCustomerCaseConfirmationEmail(
  input: ConfirmationInput,
) {
  const env = getRuntimeBindings();
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.ORDER_EMAIL_FROM?.trim();
  const config = getPublicLegalConfig();

  if (!apiKey || !from || !input.email) {
    return { sent: false as const, reason: "email_not_configured" as const };
  }

  const label = typeLabel(input.type);
  const subject = `Potwierdzenie zgłoszenia ${input.id} · a_bags.handmade`;
  const dueLine =
    input.type === "complaint" && input.responseDueAt
      ? `Termin odpowiedzi zapisany w systemie: ${formatDate(input.responseDueAt)}`
      : "";

  const text = [
    `Potwierdzamy otrzymanie zgłoszenia: ${label}.`,
    "",
    `Numer sprawy: ${input.id}`,
    `Data przyjęcia: ${formatDate(input.createdAt)}`,
    input.orderReference ? `Numer / identyfikator zamówienia: ${input.orderReference}` : "",
    input.productName ? `Produkt: ${input.productName}` : "",
    input.requestedResolution
      ? `Oczekiwane rozwiązanie: ${input.requestedResolution}`
      : "",
    dueLine,
    "",
    `Kontakt sprzedawcy: ${config.seller.email}`,
    `Informacje o zwrotach i reklamacjach: ${STORE_URL}/zwroty-i-reklamacje`,
    `Polityka prywatności: ${STORE_URL}/polityka-prywatnosci`,
    "",
    "Zachowaj tę wiadomość jako potwierdzenie wysłania zgłoszenia.",
  ]
    .filter(Boolean)
    .join("\n");

  const optionalRows = [
    input.orderReference
      ? `<tr><td style="padding:7px 0">Zamówienie</td><td style="padding:7px 0;text-align:right">${escapeHtml(input.orderReference)}</td></tr>`
      : "",
    input.productName
      ? `<tr><td style="padding:7px 0">Produkt</td><td style="padding:7px 0;text-align:right">${escapeHtml(input.productName)}</td></tr>`
      : "",
    input.requestedResolution
      ? `<tr><td style="padding:7px 0">Oczekiwane rozwiązanie</td><td style="padding:7px 0;text-align:right">${escapeHtml(input.requestedResolution)}</td></tr>`
      : "",
    dueLine
      ? `<tr><td style="padding:7px 0">Termin odpowiedzi</td><td style="padding:7px 0;text-align:right"><strong>${escapeHtml(formatDate(input.responseDueAt!))}</strong></td></tr>`
      : "",
  ].join("");

  const html = `
    <div style="font-family:Arial,sans-serif;color:#5a4245;line-height:1.6;max-width:680px;margin:auto">
      <h1 style="font-family:Georgia,serif;font-weight:500">Potwierdzamy otrzymanie zgłoszenia.</h1>
      <p>Rodzaj sprawy: <strong>${escapeHtml(label)}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:24px 0">
        <tr><td style="padding:7px 0">Numer sprawy</td><td style="padding:7px 0;text-align:right"><strong>${escapeHtml(input.id)}</strong></td></tr>
        <tr><td style="padding:7px 0">Data przyjęcia</td><td style="padding:7px 0;text-align:right">${escapeHtml(formatDate(input.createdAt))}</td></tr>
        ${optionalRows}
      </table>
      <p>Dalszy kontakt w sprawie będzie prowadzony na ten adres e-mail.</p>
      <p>
        <a href="${STORE_URL}/zwroty-i-reklamacje">Zwroty i reklamacje</a> ·
        <a href="${STORE_URL}/polityka-prywatnosci">Polityka prywatności</a>
      </p>
      <p style="font-size:12px;opacity:.75">Zachowaj tę wiadomość jako potwierdzenie wysłania zgłoszenia. Kontakt sprzedawcy: ${escapeHtml(config.seller.email)}</p>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `customer-case-confirmation/${input.id}`,
    },
    body: JSON.stringify({
      from,
      to: [input.email],
      reply_to: config.seller.email,
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Resend customer-case confirmation failed (${response.status}): ${body.slice(0, 300)}`,
    );
  }

  return { sent: true as const };
}

export type CustomerCaseConfirmationSource = Pick<
  NewCustomerCase,
  "email" | "customerName" | "orderReference" | "productName" | "requestedResolution"
>;
