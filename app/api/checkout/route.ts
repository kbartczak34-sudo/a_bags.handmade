import { standardShippingAmount, type CatalogProduct } from "../../../lib/catalog";
import { getOrderSettings } from "../../../lib/orders";
import { findVisibleProductsByIds } from "../../../lib/products";
import {
  detectStripeKeyMode,
  getStripeSecretKey,
  isStripeLiveWebhookReady,
  StripeConfigurationError,
} from "../../../lib/stripe";

type RequestedItem = {
  id: string;
  quantity: number;
};

type PaymentChoice = "blik" | "card" | "wallet";

type StripeCheckoutResponse = {
  id?: string;
  url?: string | null;
  error?: {
    code?: string;
    type?: string;
    message?: string;
  };
};

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePayload(value: unknown) {
  if (!isObject(value) || !Array.isArray(value.items)) return null;

  const email = typeof value.email === "string" ? value.email.trim() : "";
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return null;
  if (value.items.length === 0 || value.items.length > 12) return null;

  const quantities = new Map<string, number>();

  for (const rawItem of value.items) {
    if (!isObject(rawItem)) return null;
    const id = typeof rawItem.id === "string" ? rawItem.id : "";
    const quantity = rawItem.quantity;

    if (!/^[a-zA-Z0-9-]{1,80}$/.test(id) || !Number.isInteger(quantity)) {
      return null;
    }
    if ((quantity as number) < 1 || (quantity as number) > 10) return null;

    quantities.set(id, (quantities.get(id) ?? 0) + (quantity as number));
  }

  const items: RequestedItem[] = [];
  for (const [id, quantity] of quantities) {
    if (quantity > 10) return null;
    items.push({ id, quantity });
  }

  return { email, items };
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
  if (code === "api_key_expired" || code === "invalid_api_key") return "Stripe odrzucił klucz API używany przez sklep. Sprawdź STRIPE_SECRET_KEY w Cloudflare.";
  if (code === "stripe_permission_error") return "Klucz Stripe nie ma uprawnień do tworzenia płatności Checkout.";
  if (code === "stripe_rate_limit") return "Stripe chwilowo ogranicza liczbę żądań. Spróbuj ponownie za moment.";
  if (code === "stripe_service_error") return "Stripe ma chwilowy problem po swojej stronie. Spróbuj ponownie za moment.";
  if (code === "parameter_unknown" || code === "parameter_invalid_empty") return "Konfiguracja Stripe Checkout zawiera nieobsługiwany parametr.";
  if (code === "payment_method_unactivated") return "Wybrana metoda płatności nie jest aktywna na koncie Stripe używanym przez sklep.";
  if (code === "stripe_network_error") return "Worker nie może połączyć się z API Stripe.";
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

function addProductLineItem(
  form: URLSearchParams,
  index: number,
  product: { id: string; name: string; detail: string; unitAmount: number },
  quantity: number,
) {
  const prefix = `line_items[${index}]`;
  form.set(`${prefix}[quantity]`, String(quantity));
  form.set(`${prefix}[price_data][currency]`, "pln");
  form.set(`${prefix}[price_data][unit_amount]`, String(product.unitAmount));
  form.set(`${prefix}[price_data][product_data][name]`, product.name);
  if (product.detail) form.set(`${prefix}[price_data][product_data][description]`, product.detail);
  form.set(`${prefix}[price_data][product_data][metadata][catalog_id]`, product.id);
}

export async function POST(request: Request) {
  let payload: ReturnType<typeof parsePayload>;
  try {
    payload = parsePayload(await request.json());
  } catch {
    return json({ error: "Nieprawidłowe dane zamówienia." }, 400);
  }
  if (!payload) return json({ error: "Sprawdź koszyk i adres e-mail." }, 400);

  let productMap: Awaited<ReturnType<typeof findVisibleProductsByIds>>;
  try {
    productMap = await findVisibleProductsByIds(payload.items.map((item) => item.id));
  } catch (error) {
    console.error("Checkout catalog read failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return json({ error: "Nie udało się sprawdzić produktów w koszyku." }, 503);
  }
  if (productMap.size !== payload.items.length) {
    return json({ error: "Jeden z produktów nie jest już dostępny. Odśwież koszyk." }, 409);
  }

  const selectedProducts = payload.items.map((item) => ({
    product: productMap.get(item.id)!,
    quantity: item.quantity,
  }));

  const unavailableProducts = selectedProducts
    .filter(({ product }) => product.availabilityStatus === "unavailable")
    .map(({ product }) => product.name);
  if (unavailableProducts.length > 0) {
    console.info("Checkout blocked by product availability", {
      productIds: selectedProducts
        .filter(({ product }) => product.availabilityStatus === "unavailable")
        .map(({ product }) => product.id),
    });
    return json(
      {
        error:
          unavailableProducts.length === 1
            ? `${unavailableProducts[0]} jest chwilowo niedostępna. Usuń ją z koszyka lub zapytaj o ponowne wykonanie.`
            : "Część produktów w koszyku jest chwilowo niedostępna. Usuń je z koszyka przed płatnością.",
        code: "product_unavailable",
      },
      409,
    );
  }

  const incompleteProducts = selectedProducts
    .filter(({ product }) => !productComplianceComplete(product))
    .map(({ product }) => product.name);
  if (incompleteProducts.length > 0) {
    console.warn("Checkout blocked by incomplete product compliance", {
      productIds: selectedProducts
        .filter(({ product }) => !productComplianceComplete(product))
        .map(({ product }) => product.id),
    });
    return json(
      {
        error:
          "Sprzedaż wybranego produktu jest chwilowo wstrzymana do czasu uzupełnienia jego danych bezpieczeństwa i identyfikacji.",
        code: "product_compliance_incomplete",
      },
      503,
    );
  }

  const paymentChoice = readPaymentChoice(request);
  const shippingAmount = standardShippingAmount;
  const cartReference = selectedProducts
    .map(({ product, quantity }) => `${product.id}:${quantity}`)
    .join(",");
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const isProductionHost = ["abagshandmade.pl", "www.abagshandmade.pl"].includes(
    requestUrl.hostname.toLowerCase(),
  );

  let orderSettings = { pickupEnabled: false, pickupAddress: "" };
  try {
    orderSettings = await getOrderSettings();
  } catch (error) {
    console.warn("Pickup settings unavailable", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }

  try {
    const secretKey = getStripeSecretKey();
    const stripeMode = detectStripeKeyMode(secretKey);
    if (isProductionHost && stripeMode !== "live") {
      console.error("Checkout blocked because production host is not using Stripe live mode", {
        stripeMode,
      });
      return json(
        {
          error: "Płatności produkcyjne nie są jeszcze aktywne. [stripe_live_required]",
          code: "stripe_live_required",
        },
        503,
      );
    }
    if (isProductionHost && !isStripeLiveWebhookReady()) {
      console.error("Checkout blocked because the Stripe live webhook is not confirmed");
      return json(
        {
          error: "Webhook płatności produkcyjnych nie został jeszcze potwierdzony. [stripe_live_webhook_required]",
          code: "stripe_live_webhook_required",
        },
        503,
      );
    }

    const form = new URLSearchParams();
    form.set("mode", "payment");
    form.set("locale", "pl");
    // Promotion codes stay disabled until the store has a compliant 30-day
    // price-history mechanism for price-reduction disclosures.
    form.set("payment_method_types[0]", paymentChoice === "blik" ? "blik" : "card");
    form.set("customer_email", payload.email);
    form.set("customer_creation", "always");
    form.set("phone_number_collection[enabled]", "true");
    form.set("shipping_address_collection[allowed_countries][0]", "PL");

    form.set("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
    form.set("shipping_options[0][shipping_rate_data][fixed_amount][amount]", String(shippingAmount));
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
    form.set("client_reference_id", `abags-${crypto.randomUUID()}`);
    form.set("metadata[store]", "a_bags.handmade");
    form.set("metadata[cart]", cartReference);
    form.set("metadata[payment_choice]", paymentChoice);
    form.set("payment_intent_data[metadata][store]", "a_bags.handmade");
    form.set("payment_intent_data[metadata][cart]", cartReference);
    form.set("payment_intent_data[metadata][payment_choice]", paymentChoice);

    const shippingMessage = orderSettings.pickupEnabled && orderSettings.pickupAddress
      ? `Dostawa na terenie Polski lub bezpłatny odbiór osobisty: ${orderSettings.pickupAddress}`
      : "Dostawa jest obecnie dostępna na terenie Polski.";
    form.set("custom_text[shipping_address][message]", shippingMessage.slice(0, 1200));
    form.set(
      "custom_text[submit][message]",
      "Po płatności otrzymasz potwierdzenie na podany adres e-mail.",
    );

    selectedProducts.forEach(({ product, quantity }, index) =>
      addProductLineItem(form, index, product, quantity),
    );

    let response: Response;
    try {
      response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Idempotency-Key": `abags-checkout-${crypto.randomUUID()}`,
        },
        body: form.toString(),
      });
    } catch (error) {
      console.error("Stripe native fetch failed", {
        message: error instanceof Error ? error.message : "Unknown network error",
      });
      return json(
        {
          error: `${publicStripeErrorMessage("stripe_network_error")} [stripe_network_error]`,
          code: "stripe_network_error",
        },
        502,
      );
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
      console.error("Stripe Checkout API error", {
        status: response.status,
        code,
        type: stripeBody.error?.type,
        message: stripeBody.error?.message,
        requestId,
        paymentChoice,
      });
      return json(
        { error: `${publicStripeErrorMessage(code)} [${code}]`, code, requestId },
        502,
      );
    }
    if (!stripeBody.url) {
      console.error("Stripe Checkout response missing URL", {
        sessionId: stripeBody.id,
        requestId,
      });
      return json(
        {
          error: "Stripe utworzył sesję bez adresu przekierowania. [stripe_missing_url]",
          code: "stripe_missing_url",
          requestId,
        },
        502,
      );
    }
    return json({ url: stripeBody.url });
  } catch (error) {
    if (error instanceof StripeConfigurationError) {
      return json(
        { error: "Płatności Stripe nie mają skonfigurowanego klucza w środowisku produkcyjnym." },
        503,
      );
    }
    console.error("Checkout initialization error", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return json(
      {
        error: "Płatność jest chwilowo niedostępna. [checkout_initialization_error]",
        code: "checkout_initialization_error",
      },
      502,
    );
  }
}
