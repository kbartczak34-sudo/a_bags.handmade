import Stripe from "stripe";

export class StripeConfigurationError extends Error {
  constructor() {
    super("Stripe is not configured");
    this.name = "StripeConfigurationError";
  }
}

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new StripeConfigurationError();
  }

  return new Stripe(secretKey, {
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 2,
  });
}

export function getStripeWebhookSecret() {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new StripeConfigurationError();
  }

  return webhookSecret;
}

export const stripeCryptoProvider = Stripe.createSubtleCryptoProvider();
