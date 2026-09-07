import { standardShippingAmount } from "../../../../lib/catalog";
import { getOrderSettings } from "../../../../lib/orders";
import { getProductionSnapshot } from "../../../../lib/production-snapshots";
import { detectStripeKeyMode, getStripeSecretKey, isStripeLiveWebhookReady, StripeConfigurationError } from "../../../../lib/stripe";

function json(data: unknown, status = 200) { return Response.json(data, { status, headers: { "Cache-Control": "no-store" } }); }
function isObject(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function parsePayload(value: unknown) {
  if (!isObject(value)) return null;
  const snapshotId = typeof value.snapshotId === "string" ? value.snapshotId.trim() : "";
  const email = typeof value.email === "string" ? value.email.trim() : "";
  if (!/^ps_[0-9a-f-]{36}$/.test(snapshotId)) return null;
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return null;
  return { snapshotId, email };
}
function publicStripeError(code: string) {
  if (code === "invalid_api_key" || code === "api_key_expired") return "Stripe odrzucił klucz API używany przez sklep.";
  if (code === "stripe_rate_limit") return "Stripe chwilowo ogranicza liczbę żądań. Spróbuj ponownie za moment.";
  if (code === "stripe_service_error") return "Stripe ma chwilowy problem po swojej stronie. Spróbuj ponownie za moment.";
  if (code === "stripe_network_error") return "Worker nie może połączyć się z API Stripe.";
  return "Płatność jest chwilowo niedostępna. Spróbuj ponownie za moment.";
}
function classifyStripeError(status: number, error: { code?: string; type?: string } | undefined) {
  if (error?.code) return error.code;
  if (status === 401) return "invalid_api_key";
  if (status === 403 || error?.type === "permission_error") return "stripe_permission_error";
  if (status === 429) return "stripe_rate_limit";
  if (status >= 500) return "stripe_service_error";
  return "stripe_api_error";
}

export async function POST(request: Request) {
  let payload: ReturnType<typeof parsePayload>;
  try { payload = parsePayload(await request.json()); } catch { return json({ error: "Nieprawidłowe dane płatności.", code: "INVALID_JSON" }, 400); }
  if (!payload) return json({ error: "Wymagany jest istniejący Production Snapshot i prawidłowy adres e-mail." }, 400);
  const snapshot = await getProductionSnapshot(payload.snapshotId);
  if (!snapshot) return json({ error: "Production Snapshot nie istnieje lub wygasł.", code: "PRODUCTION_SNAPSHOT_NOT_FOUND" }, 404);
  const productionPackage = snapshot.package;
  if (!isObject(productionPackage)) return json({ error: "Production Snapshot jest nieprawidłowy.", code: "PRODUCTION_SNAPSHOT_INVALID" }, 409);
  const pricing = productionPackage.pricing;
  if (!isObject(pricing) || pricing.status !== "AVAILABLE" || pricing.currency !== "PLN" || !Number.isInteger(pricing.grossCents) || (pricing.grossCents as number) < 1) return json({ error: "Cena konfiguracji nie jest dostępna do bezpiecznej płatności.", code: "SNAPSHOT_PRICING_UNAVAILABLE" }, 409);
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const isProductionHost = ["abagshandmade.pl", "www.abagshandmade.pl"].includes(requestUrl.hostname.toLowerCase());
  try {
    const secretKey = getStripeSecretKey();
    if (isProductionHost && detectStripeKeyMode(secretKey) !== "live") return json({ error: "Płatności produkcyjne nie są jeszcze aktywne.", code: "stripe_live_required" }, 503);
    if (isProductionHost && !isStripeLiveWebhookReady()) return json({ error: "Webhook płatności produkcyjnych nie został jeszcze potwierdzony.", code: "stripe_live_webhook_required" }, 503);
    let orderSettings = { pickupEnabled: false, pickupAddress: "" };
    try { orderSettings = await getOrderSettings(); } catch (error) { console.warn("Configurator checkout pickup settings unavailable", { message: error instanceof Error ? error.message : "Unknown error" }); }
    const form = new URLSearchParams();
    form.set("mode", "payment");
    form.set("locale", "pl");
    form.set("payment_method_types[0]", "blik");
    form.set("payment_method_types[1]", "card");
    form.set("customer_email", payload.email);
    form.set("customer_creation", "always");
    form.set("phone_number_collection[enabled]", "true");
    form.set("shipping_address_collection[allowed_countries][0]", "PL");
    form.set("line_items[0][quantity]", "1");
    form.set("line_items[0][price_data][currency]", "pln");
    form.set("line_items[0][price_data][unit_amount]", String(pricing.grossCents));
    form.set("line_items[0][price_data][product_data][name]", "A-Bags Handmade — konfiguracja indywidualna");
    form.set("line_items[0][price_data][product_data][description]", `Production Snapshot ${snapshot.id}`);
    form.set("line_items[0][price_data][product_data][metadata][snapshot_id]", snapshot.id);
    form.set("line_items[0][price_data][product_data][metadata][production_package_hash]", snapshot.packageHash);
    form.set("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
    form.set("shipping_options[0][shipping_rate_data][fixed_amount][amount]", String(standardShippingAmount));
    form.set("shipping_options[0][shipping_rate_data][fixed_amount][currency]", "pln");
    form.set("shipping_options[0][shipping_rate_data][display_name]", "Dostawa w Polsce");
    form.set("shipping_options[0][shipping_rate_data][delivery_estimate][minimum][unit]", "business_day");
    form.set("shipping_options[0][shipping_rate_data][delivery_estimate][minimum][value]", "2");
    form.set("shipping_options[0][shipping_rate_data][delivery_estimate][maximum][unit]", "business_day");
    form.set("shipping_options[0][shipping_rate_data][delivery_estimate][maximum][value]", "5");
    if (orderSettings.pickupEnabled && orderSettings.pickupAddress) {
      form.set("shipping_options[1][shipping_rate_data][type]", "fixed_amount");
      form.set("shipping_options[1][shipping_rate_data][fixed_amount][amount]", "0");
      form.set("shipping_options[1][shipping_rate_data][fixed_amount][currency]", "pln");
      form.set("shipping_options[1][shipping_rate_data][display_name]", "Odbiór osobisty");
    }
    form.set("success_url", `${origin}/zamowienie/sukces?session_id={CHECKOUT_SESSION_ID}`);
    form.set("cancel_url", `${origin}/?platnosc=anulowana#kolekcja`);
    form.set("client_reference_id", `abags-${snapshot.id}`);
    form.set("metadata[store]", "a_bags.handmade");
    form.set("metadata[checkout_type]", "CONFIGURATOR_V2");
    form.set("metadata[snapshot_id]", snapshot.id);
    form.set("metadata[production_package_hash]", snapshot.packageHash);
    form.set("payment_intent_data[metadata][store]", "a_bags.handmade");
    form.set("payment_intent_data[metadata][checkout_type]", "CONFIGURATOR_V2");
    form.set("payment_intent_data[metadata][snapshot_id]", snapshot.id);
    form.set("payment_intent_data[metadata][production_package_hash]", snapshot.packageHash);
    form.set("custom_text[submit][message]", "Płatność jest przypisana do niezmiennego Production Snapshot tej konfiguracji.");
    let response: Response;
    try {
      response = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": `abags-configurator-checkout-${snapshot.id}` }, body: form.toString() });
    } catch (error) {
      console.error("Configurator Stripe fetch failed", { message: error instanceof Error ? error.message : "Unknown error" });
      return json({ error: `${publicStripeError("stripe_network_error")} [stripe_network_error]`, code: "stripe_network_error" }, 502);
    }
    const requestId = response.headers.get("request-id") ?? undefined;
    let stripeBody: { id?: string; url?: string | null; error?: { code?: string; type?: string; message?: string } } = {};
    try { stripeBody = await response.json(); } catch {}
    if (!response.ok) {
      const code = classifyStripeError(response.status, stripeBody.error);
      console.error("Configurator Stripe Checkout API error", { status: response.status, code, requestId });
      return json({ error: `${publicStripeError(code)} [${code}]`, code, requestId }, 502);
    }
    if (!stripeBody.url) return json({ error: "Stripe utworzył sesję bez adresu przekierowania.", code: "stripe_missing_url", requestId }, 502);
    return json({ url: stripeBody.url, snapshotId: snapshot.id, productionPackageHash: snapshot.packageHash });
  } catch (error) {
    if (error instanceof StripeConfigurationError) return json({ error: "Płatności Stripe nie mają skonfigurowanego klucza w środowisku produkcyjnym.", code: "stripe_configuration_error" }, 503);
    console.error("Configurator checkout initialization failed", { message: error instanceof Error ? error.message : "Unknown error" });
    return json({ error: "Płatność jest chwilowo niedostępna.", code: "checkout_initialization_error" }, 502);
  }
}
