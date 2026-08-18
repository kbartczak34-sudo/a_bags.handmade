import { getStripe, StripeConfigurationError } from "../../../../lib/stripe";

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session_id") ?? "";

  if (!/^cs_(test_|live_)?[A-Za-z0-9_]+$/.test(sessionId)) {
    return json({ error: "Nieprawidłowe potwierdzenie płatności." }, 400);
  }

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);

    if (session.metadata?.store !== "a_bags.handmade") {
      return json({ error: "Nie znaleziono zamówienia." }, 404);
    }

    return json({
      id: session.id,
      paymentStatus: session.payment_status,
      status: session.status,
      amountTotal: session.amount_total,
      currency: session.currency,
      email: session.customer_details?.email ?? session.customer_email,
    });
  } catch (error) {
    if (error instanceof StripeConfigurationError) {
      return json({ error: "Płatności Stripe nie są jeszcze skonfigurowane." }, 503);
    }

    return json({ error: "Nie udało się sprawdzić płatności." }, 404);
  }
}
