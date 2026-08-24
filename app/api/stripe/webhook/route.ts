import type Stripe from "stripe";
import { processFirstTenGift } from "../../../../lib/gift-rewards";
import { sendOrderConfirmationEmail } from "../../../../lib/order-email";
import {
  recordStripeOrderEvent,
  recordStripeRefundEvent,
} from "../../../../lib/orders";
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
        await recordStripeOrderEvent(event, session);

        const isSuccessfulPaymentEvent =
          event.type === "checkout.session.completed" ||
          event.type === "checkout.session.async_payment_succeeded";
        const isPaid =
          session.payment_status === "paid" ||
          session.payment_status === "no_payment_required";

        if (isSuccessfulPaymentEvent && isPaid) {
          const gift = await processFirstTenGift(session);
          if (gift) {
            console.info("First-ten order gift processed", {
              sessionId: session.id,
              slot: gift.slot,
            });
          }

          const confirmation = await sendOrderConfirmationEmail(session);
          console.info("Order confirmation processed", {
            sessionId: session.id,
            sent: confirmation.sent,
            reason: "reason" in confirmation ? confirmation.reason : undefined,
          });
        }

        console.info("Stripe order event persisted", {
          eventId: event.id,
          eventType: event.type,
          sessionId: session.id,
          paymentStatus: session.payment_status,
        });
      }
    }

    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const refund = await recordStripeRefundEvent(event, charge);
      console.info("Stripe refund event processed", {
        eventId: event.id,
        chargeId: charge.id,
        paymentIntentId:
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent?.id,
        matched: refund.matched,
        refundStatus: refund.refundStatus,
      });
    }

    return Response.json({ received: true });
  } catch (error) {
    if (error instanceof StripeConfigurationError) {
      return new Response("Stripe webhook is not configured", { status: 503 });
    }

    console.warn("Stripe webhook processing failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return new Response("Webhook processing failed", { status: 400 });
  }
}
