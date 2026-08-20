import Stripe from "stripe";
import { getRuntimeBindings } from "./runtime-env";

export class StripeConfigurationError extends Error {
  constructor() {
    super("Stripe is not configured");
    this.name = "StripeConfigurationError";
  }
}

function readSecret(name: "STRIPE_SECRET_KEY" | "STRIPE_WEBHOOK_SECRET") {
  const runtime = getRuntimeBindings();
  return runtime[name] ?? process.env[name];
}

export function getStripe() {
  const secretKey = readSecret("STRIPE_SECRET_KEY");

  if (!secretKey) {
    throw new StripeConfigurationError();
  }

  return new Stripe(secretKey, {
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 2,
  });
}

export function getStripeWebhookSecret() {
  const webhookSecret = readSecret("STRIPE_WEBHOOK_SECRET");

  if (!webhookSecret) {
    throw new StripeConfigurationError();
  }

  return webhookSecret;
}

export const stripeCryptoProvider = Stripe.createSubtleCryptoProvider();
