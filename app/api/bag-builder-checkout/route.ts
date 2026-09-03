import { standardShippingAmount, type CatalogProduct } from "../../../lib/catalog";
import {
  bagBuilderProjectCode,
  bagBuilderProjectSummary,
  calculateBagBuilderProjectCents,
  getBagBuilderSettings,
  isBagBuilderProjectCompatible,
  normalizeBagBuilderProjectConfig,
} from "../../../lib/bag-builder-settings";
import { getOrderSettings } from "../../../lib/orders";
import { findVisibleProductsByIds } from "../../../lib/products";
import {
  detectStripeKeyMode,
  getStripeSecretKey,
  isStripeLiveWebhookReady,
  StripeConfigurationError,
} from "../../../lib/stripe";

type PaymentChoice = "blik" | "card" | "wallet";
type StripeCheckoutResponse = {
  id?: string;
  url?: string | null;
  error?: { code?: string; type?: string; message?: string };
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function readPaymentChoice(request: Request): PaymentChoice {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)abags-payment-method=(blik|card|wallet)(?:;|$)/);
  return (match?.[1] as PaymentChoice | undefined) ?? "blik";
}

function productComplianceComplete(product: CatalogProduct) {
  return Boolean(
    product.productIdentifier.trim() &&
      product.materials.trim() &&
      product.careInstructions.trim() &&
      product.safetyInfo.trim(),
  );
}

function publicStripeErrorMessage(code: string) {
  if (code === "api_key_expired" || code === "invalid_api_key") return "Stripe odrzucił klucz API używany przez sklep.";
  if (code === "stripe_permission_error") return "Klucz Stripe nie ma uprawnień do tworzenia płatności Checkout.";
  if (code === "stripe_rate_limit") return "Stripe chwilowo ogranicza liczbę żądań. Spróbuj ponownie za moment.";
  if (code === "stripe_service_error") return "Stripe ma chwilowy problem po swojej stronie. Spróbuj ponownie za moment.";
  if (code === "payment_method_unactivated") return "Wybrana metoda płatności nie jest aktywna na koncie Stripe używanym przez sklep.";
  if (code === "stripe_network_error") return "Sklep nie może chwilowo połączyć się z API Stripe.";
  return "Płatność jest chwilowo niedostępna. Spróbuj ponownie za moment.";
}

function classifyStripeApiError(status: number, stripeError: StripeCheckoutResponse["error"]) {
  if (stripeError?.code) return stripeError.code;
  const type = stripeError?.type ?? "";
  const message = stripeError?.message?.toLowerCase() ?? "";
  if (status === 401 || message.includes("invalid api key") || message.includes("api key provided")) return "invalid_api_key";
  if (status === 403 || type === "permission_error") return "stripe_permission_error";
  if (status === 429) return "stripe_rate_limit";
  if (status >= 500) return "stripe_service_error";
  return "stripe_api_error";
}

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ error: "Nieprawidłowe dane projektu." }, 400);
  }

  const source = typeof raw === "object" && raw ? (raw as Record<string, unknown>).config : null;
  const config = normalizeBagBuilderProjectConfig(source);
  if (!config) return json({ error: "Projekt jest niekompletny lub zawiera nieobsługiwaną opcję." }, 400);

  let settings: Awaited<ReturnType<typeof getBagBuilderSettings>>;
  try {
    settings = await getBagBuilderSettings();
  } catch {
    return json({ error: "Nie udało się sprawdzić ustawień personalizacji." }, 503);
  }

  if (!settings.pricingEnabled) {
    return json({ error: "Zakup online tego projektu nie jest jeszcze aktywny. Wyślij projekt do pracowni w celu wyceny.", code: "builder_pricing_disabled" }, 409);
  }
  if (!isBagBuilderProjectCompatible(config, settings)) {
    return json({ error: "Wybrana konfiguracja nie jest możliwa dla tego fasonu. Wróć do kreatora i wybierz inną opcję.", code: "builder_incompatible" }, 409);
  }

  const productId = settings.familyProductIds[config.family];
  if (!productId) {
    return json({ error: "Ten fason nie ma jeszcze przypisanego produktu bazowego do bezpiecznej sprzedaży online.", code: "builder_product_unmapped" }, 409);
  }

  const projectAmount = calculateBagBuilderProjectCents(config, settings);
  if (projectAmount === null || projectAmount < 1) {
    return json({ error: "Cena projektu nie została jeszcze skonfigurowana przez pracownię.", code: "builder_price_unavailable" }, 409);
  }

  let baseProduct: CatalogProduct | undefined;
  try {
    baseProduct = (await findVisibleProductsByIds([productId])).get(productId);
  } catch {
    return json({ error: "Nie udało się sprawdzić produktu bazowego." }, 503);
  }
  if (!baseProduct) {
    return json({ error: "Przypisany produkt bazowy nie jest obecnie dostępny w sklepie.", code: "builder_product_unavailable" }, 409);
  }
  if (!productComplianceComplete(baseProduct)) {
    return json({
      error: "Sprzedaż tego projektu jest chwilowo wstrzymana do czasu uzupełnienia danych bezpieczeństwa produktu bazowego.",
      code: "product_compliance_incomplete",
    }, 503);
  }

  const projectCode = bagBuilderProjectCode(config);
  const summary = bagBuilderProjectSummary(config);
  const material = "Sznurek poliestrowy z Pimiotki";
  const cartReference = `Projekt ${projectCode} · ${baseProduct.name} · ${material} · ${summary}`.slice(0, 500);
  const configJson = JSON.stringify(config);
  const paymentChoice = readPaymentChoice(request);
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const isProductionHost = ["abagshandmade.pl", "www.abagshandmade.pl"].includes(requestUrl.hostname.toLowerCase());

  let orderSettings = { pickupEnabled: false, pickupAddress: "" };
  try {
    orderSettings = await getOrderSettings();
  } catch {
    // Standard shipping remains available when pickup settings cannot be read.
  }

  try {
    const secretKey = getStripeSecretKey();
    const stripeMode = detectStripeKeyMode(secretKey);
    if (isProductionHost && stripeMode !== "live") {
      return json({ error: "Płatności produkcyjne nie są jeszcze aktywne. [stripe_live_required]", code: "stripe_live_required" }, 503);
    }
    if (isProductionHost && !isStripeLiveWebhookReady()) {
      return json({ error: "Webhook płatności produkcyjnych nie został jeszcze potwierdzony. [stripe_live_webhook_required]", code: "stripe_live_webhook_required" }, 503);
    }

    const form = new URLSearchParams();
    form.set("mode", "payment");
    form.set("locale", "pl");
    form.set("payment_method_types[0]", paymentChoice === "blik" ? "blik" : "card");
    form.set("customer_creation", "always");
    form.set("phone_number_collection[enabled]", "true");
    form.set("shipping_address_collection[allowed_countries][0]", "PL");

    form.set("line_items[0][quantity]", "1");
    form.set("line_items[0][price_data][currency]", "pln");
    form.set("line_items[0][price_data][unit_amount]", String(projectAmount));
    form.set("line_items[0][price_data][product_data][name]", `${baseProduct.name} · projekt ${projectCode}`);
    form.set("line_items[0][price_data][product_data][description]", `${material}. ${summary}`.slice(0, 500));
    form.set("line_items[0][price_data][product_data][metadata][catalog_id]", baseProduct.id);
    form.set("line_items[0][price_data][product_data][metadata][project_code]", projectCode);
    form.set("line_items[0][price_data][product_data][metadata][personalized]", "true");

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
    form.set("cancel_url", `${origin}/?platnosc=anulowana#personalizacja`);
    form.set("client_reference_id", `abags-${projectCode.toLowerCase()}-${crypto.randomUUID()}`.slice(0, 200));
    form.set("metadata[store]", "a_bags.handmade");
    form.set("metadata[cart]", cartReference);
    form.set("metadata[payment_choice]", paymentChoice);
    form.set("metadata[builder_project_code]", projectCode);
    form.set("metadata[builder_project_config]", configJson);
    form.set("metadata[builder_catalog_id]", baseProduct.id);
    form.set("payment_intent_data[metadata][store]", "a_bags.handmade");
    form.set("payment_intent_data[metadata][cart]", cartReference);
    form.set("payment_intent_data[metadata][payment_choice]", paymentChoice);
    form.set("payment_intent_data[metadata][builder_project_code]", projectCode);
    form.set("payment_intent_data[metadata][builder_project_config]", configJson);
    form.set("payment_intent_data[metadata][builder_catalog_id]", baseProduct.id);

    const shippingMessage = orderSettings.pickupEnabled && orderSettings.pickupAddress
      ? `Dostawa na terenie Polski lub bezpłatny odbiór osobisty: ${orderSettings.pickupAddress}`
      : "Dostawa jest obecnie dostępna na terenie Polski.";
    form.set("custom_text[shipping_address][message]", shippingMessage.slice(0, 1200));
    form.set("custom_text[submit][message]", `Projekt ${projectCode} jest wykonywany według wybranej konfiguracji. Po płatności otrzymasz potwierdzenie e-mail.`);

    let response: Response;
    try {
      response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Idempotency-Key": `abags-builder-${projectCode}-${crypto.randomUUID()}`,
        },
        body: form.toString(),
      });
    } catch {
      return json({ error: `${publicStripeErrorMessage("stripe_network_error")} [stripe_network_error]`, code: "stripe_network_error" }, 502);
    }

    const requestId = response.headers.get("request-id") ?? undefined;
    let stripeBody: StripeCheckoutResponse;
    try {
      stripeBody = (await response.json()) as StripeCheckoutResponse;
    } catch {
      stripeBody = {};
    }
    if (!response.ok) {
      const code = classifyStripeApiError(response.status, stripeBody.error);
      console.error("Bag Builder Stripe Checkout API error", { status: response.status, code, requestId, projectCode });
      return json({ error: `${publicStripeErrorMessage(code)} [${code}]`, code, requestId }, 502);
    }
    if (!stripeBody.url) {
      return json({ error: "Stripe utworzył sesję bez adresu przekierowania. [stripe_missing_url]", code: "stripe_missing_url", requestId }, 502);
    }

    return json({ url: stripeBody.url, projectCode });
  } catch (error) {
    if (error instanceof StripeConfigurationError) {
      return json({ error: "Płatności Stripe nie mają skonfigurowanego klucza w środowisku produkcyjnym." }, 503);
    }
    console.error("Bag Builder checkout initialization error", {
      message: error instanceof Error ? error.message : "Unknown error",
      projectCode,
    });
    return json({ error: "Płatność projektu jest chwilowo niedostępna. [builder_checkout_initialization_error]", code: "builder_checkout_initialization_error" }, 502);
  }
}
