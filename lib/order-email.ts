import type Stripe from "stripe";
import { getPublicLegalConfig } from "./legal-config";
import { getRuntimeBindings } from "./runtime-env";

const STORE_URL = "https://abagshandmade.pl";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatAmount(amount: number | null, currency: string | null) {
  if (amount === null) return "—";
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: (currency ?? "pln").toUpperCase(),
  }).format(amount / 100);
}

function readBuilderProjectCode(session: Stripe.Checkout.Session) {
  const value = session.metadata?.builder_project_code ?? "";
  return /^AB-[A-Z0-9]{7}$/.test(value) ? value : null;
}

export async function sendOrderConfirmationEmail(session: Stripe.Checkout.Session) {
  const env = getRuntimeBindings();
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.ORDER_EMAIL_FROM?.trim();
  const config = getPublicLegalConfig();
  const to = session.customer_details?.email ?? session.customer_email ?? null;

  if (!apiKey || !from || !to) {
    return { sent: false as const, reason: "email_not_configured" as const };
  }

  const orderNumber = session.id.slice(-8).toUpperCase();
  const amount = formatAmount(session.amount_total ?? null, session.currency ?? null);
  const sellerName = config.seller.legalName || config.brand;
  const sellerAddress = config.seller.address || "—";
  const returnsAddress = config.seller.returnsAddress || sellerAddress;
  const nip = config.seller.nip ? `NIP: ${config.seller.nip}` : "";
  const cartReference = (session.metadata?.cart ?? "—").slice(0, 500);
  const builderProjectCode = readBuilderProjectCode(session);
  const personalizedProject = Boolean(builderProjectCode);

  const subject = builderProjectCode
    ? `Potwierdzenie projektu ${builderProjectCode} · zamówienie #${orderNumber}`
    : `Potwierdzenie zamówienia #${orderNumber} · a_bags.handmade`;

  const text = [
    "Dziękujemy za zamówienie w a_bags.handmade.",
    "",
    `Numer zamówienia: #${orderNumber}`,
    `Kwota: ${amount}`,
    `Status płatności: ${session.payment_status}`,
    personalizedProject ? `Kod projektu A-Bags: ${builderProjectCode}` : null,
    personalizedProject ? "Materiał bazowy: sznurek poliestrowy z Pimiotki" : null,
    personalizedProject ? `Specyfikacja projektu: ${cartReference}` : `Pozycje zamówienia: ${cartReference}`,
    personalizedProject ? "Projekt zostanie zrealizowany zgodnie z konfiguracją zapisaną przy płatności." : null,
    "",
    `Sprzedawca: ${sellerName}`,
    `Adres: ${sellerAddress}`,
    nip,
    `E-mail: ${config.seller.email}`,
    `Telefon: ${config.seller.phone}`,
    "",
    "Prawo odstąpienia:",
    "Konsument może co do zasady odstąpić od umowy zawartej przez internet w terminie 14 dni od otrzymania towaru. Wyjątek może dotyczyć rzeczywiście zindywidualizowanego produktu wykonanego według specyfikacji konsumenta.",
    `Adres zwrotów i reklamacji: ${returnsAddress}`,
    "",
    `Regulamin: ${STORE_URL}/regulamin`,
    `Zwroty i reklamacje: ${STORE_URL}/zwroty-i-reklamacje`,
    `Polityka prywatności: ${STORE_URL}/polityka-prywatnosci`,
    `Bezpieczeństwo produktów: ${STORE_URL}/bezpieczenstwo-produktow`,
    "",
    builderProjectCode
      ? `Zachowaj tę wiadomość oraz kod projektu ${builderProjectCode} jako potwierdzenie zamówionej konfiguracji.`
      : "Zachowaj tę wiadomość jako potwierdzenie warunków zawartej umowy.",
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");

  const personalizedHtml = builderProjectCode
    ? `
      <div style="margin:24px 0;padding:18px 20px;border-radius:18px;background:#fff6f3;border:1px solid #ead7d5">
        <p style="margin:0 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#9b6670">Twój projekt A-Bags</p>
        <p style="margin:0 0 10px;font-family:Georgia,serif;font-size:24px"><strong>${escapeHtml(builderProjectCode)}</strong></p>
        <p style="margin:0 0 6px"><strong>Materiał bazowy:</strong> sznurek poliestrowy z Pimiotki</p>
        <p style="margin:0"><strong>Specyfikacja:</strong> ${escapeHtml(cartReference)}</p>
        <p style="margin:10px 0 0;font-size:13px;opacity:.78">Projekt zostanie zrealizowany zgodnie z konfiguracją zapisaną przy płatności.</p>
      </div>
    `
    : "";

  const html = `
    <div style="font-family:Arial,sans-serif;color:#5a4245;line-height:1.6;max-width:680px;margin:auto">
      <h1 style="font-family:Georgia,serif;font-weight:500">Dziękujemy za zamówienie.</h1>
      <p>Potwierdzamy przyjęcie zamówienia w <strong>a_bags.handmade</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:24px 0">
        <tr><td style="padding:8px 0">Numer zamówienia</td><td style="padding:8px 0;text-align:right"><strong>#${escapeHtml(orderNumber)}</strong></td></tr>
        <tr><td style="padding:8px 0">Kwota</td><td style="padding:8px 0;text-align:right"><strong>${escapeHtml(amount)}</strong></td></tr>
        <tr><td style="padding:8px 0">Status płatności</td><td style="padding:8px 0;text-align:right">${escapeHtml(session.payment_status)}</td></tr>
        ${personalizedProject ? "" : `<tr><td style="padding:8px 0">Pozycje zamówienia</td><td style="padding:8px 0;text-align:right">${escapeHtml(cartReference)}</td></tr>`}
      </table>
      ${personalizedHtml}
      <h2 style="font-family:Georgia,serif;font-weight:500">Sprzedawca</h2>
      <p><strong>${escapeHtml(sellerName)}</strong><br>${escapeHtml(sellerAddress)}${nip ? `<br>${escapeHtml(nip)}` : ""}<br>${escapeHtml(config.seller.email)}<br>${escapeHtml(config.seller.phone)}</p>
      <h2 style="font-family:Georgia,serif;font-weight:500">Prawo odstąpienia i reklamacje</h2>
      <p>Konsument może co do zasady odstąpić od umowy zawartej przez internet w terminie 14 dni od otrzymania towaru. Wyjątek może dotyczyć produktu rzeczywiście wykonanego według indywidualnej specyfikacji konsumenta.</p>
      <p><strong>Adres zwrotów i reklamacji:</strong><br>${escapeHtml(returnsAddress)}</p>
      <p>
        <a href="${STORE_URL}/regulamin">Regulamin sklepu</a> ·
        <a href="${STORE_URL}/zwroty-i-reklamacje">Zwroty i reklamacje</a> ·
        <a href="${STORE_URL}/polityka-prywatnosci">Polityka prywatności</a> ·
        <a href="${STORE_URL}/bezpieczenstwo-produktow">Bezpieczeństwo produktów</a>
      </p>
      <p style="font-size:12px;opacity:.75">${builderProjectCode ? `Zachowaj tę wiadomość oraz kod projektu ${escapeHtml(builderProjectCode)} jako potwierdzenie zamówionej konfiguracji.` : "Zachowaj tę wiadomość jako potwierdzenie warunków zawartej umowy."}</p>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `order-confirmation/${session.id}`,
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: config.seller.email,
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Resend confirmation failed (${response.status}): ${body.slice(0, 300)}`);
  }

  return { sent: true as const };
}
