import type Stripe from "stripe";
import { standardShippingAmount } from "../../../lib/catalog";
import { findVisibleProductsByIds } from "../../../lib/products";
import { getStripe, StripeConfigurationError } from "../../../lib/stripe";

type RequestedItem = {
  id: string;
  quantity: number;
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

function stripeErrorCode(error: unknown) {
  if (!error || typeof error !== "object") return undefined;
  const value = error as { code?: unknown; type?: unknown; requestId?: unknown };
  return {
    code: typeof value.code === "string" ? value.code : undefined,
    type: typeof value.type === "string" ? value.type : undefined,
    requestId: typeof value.requestId === "string" ? value.requestId : undefined,
  };
}

export async function POST(request: Request) {
  let payload: ReturnType<typeof parsePayload>;

  try {
    payload = parsePayload(await request.json());
  } catch {
    return json({ error: "Nieprawidłowe dane zamówienia." }, 400);
  }

  if (!payload) {
    return json({ error: "Sprawdź koszyk i adres e-mail." }, 400);
  }

  let productMap: Awaited<ReturnType<typeof findVisibleProductsByIds>>;
  try {
    productMap = await findVisibleProductsByIds(
      payload.items.map((item) => item.id),
    );
  } catch (error) {
    console.error("Checkout catalog read failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return json({ error: "Nie udało się sprawdzić produktów w koszyku." }, 503);
  }

  if (productMap.size !== payload.items.length) {
    return json(
      { error: "Jeden z produktów nie jest już dostępny. Odśwież koszyk." },
      409,
    );
  }

  const selectedProducts = payload.items.map((item) => ({
    product: productMap.get(item.id)!,
    quantity: item.quantity,
  }));
  const shippingAmount = standardShippingAmount;
  const cartReference = selectedProducts
    .map(({ product, quantity }) => `${product.id}:${quantity}`)
    .join(",");

  const origin = new URL(request.url).origin;

  try {
    const stripe = getStripe();
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
      selectedProducts.map(({ product, quantity }) => ({
        quantity,
        price_data: {
          currency: "pln",
          unit_amount: product.unitAmount,
          product_data: {
            name: product.name,
            description: product.detail,
            metadata: { catalog_id: product.id },
          },
        },
      }));

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      locale: "pl",
      automatic_payment_methods: { enabled: true },
      line_items: lineItems,
      customer_email: payload.email,
      customer_creation: "always",
      phone_number_collection: { enabled: true },
      shipping_address_collection: { allowed_countries: ["PL"] },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: shippingAmount, currency: "pln" },
            display_name: "Dostawa w Polsce",
            delivery_estimate: {
              minimum: { unit: "business_day", value: 2 },
              maximum: { unit: "business_day", value: 5 },
            },
          },
        },
      ],
      success_url: `${origin}/zamowienie/sukces?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?platnosc=anulowana#kolekcja`,
      client_reference_id: `abags-${crypto.randomUUID()}`,
      metadata: {
        store: "a_bags.handmade",
        cart: cartReference,
      },
      payment_intent_data: {
        metadata: {
          store: "a_bags.handmade",
          cart: cartReference,
        },
      },
      custom_text: {
        shipping_address: {
          message: "Dostawa jest obecnie dostępna na terenie Polski.",
        },
        submit: {
          message:
            "Po płatności otrzymasz potwierdzenie na podany adres e-mail.",
        },
      },
    });

    if (!session.url) {
      return json({ error: "Nie udało się otworzyć bezpiecznej płatności." }, 502);
    }

    return json({ url: session.url });
  } catch (error) {
    if (error instanceof StripeConfigurationError) {
      return json(
        { error: "Płatności Stripe są jeszcze w trakcie bezpiecznej konfiguracji." },
        503,
      );
    }

    const details = stripeErrorCode(error);
    console.error("Stripe Checkout Session error", {
      message: error instanceof Error ? error.message : "Unknown error",
      ...details,
    });
    return json(
      {
        error: "Płatność jest chwilowo niedostępna. Spróbuj ponownie za moment.",
        code: details?.code ?? "stripe_checkout_error",
        requestId: details?.requestId,
      },
      502,
    );
  }
}
