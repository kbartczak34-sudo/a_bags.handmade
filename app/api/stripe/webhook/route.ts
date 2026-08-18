import type Stripe from "stripe";
import {
  getStripe,
  getStripeWebhookSecret,
  stripeCryptoProvider,
  StripeConfigurationError,
} from "../../../../lib/stripe";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing Stripe signature", { status: 400 });
  }

  try {
    const rawBody = await request.text();
    const event = await getStripe().webhooks.constructEventAsync(
      rawBody,
      signature,
      getStripeWebhookSecret(),
      undefined,
      stripeCryptoProvider,
    );

    const supportedEvents = new Set([
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.async_payment_failed",
      "checkout.session.expired",
    ]);

    if (supportedEvents.has(event.type)) {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.store === "a_bags.handmade") {
        console.info("Stripe order event", {
          eventId: event.id,
          eventType: event.type,
          sessionId: session.id,
          paymentStatus: session.payment_status,
        });
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    if (error instanceof StripeConfigurationError) {
      return new Response("Stripe webhook is not configured", { status: 503 });
    }

    console.warn("Stripe webhook signature verification failed");
    return new Response("Invalid Stripe signature", { status: 400 });
  }
}
