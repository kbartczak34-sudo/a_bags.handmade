import Stripe from "stripe";
import { getRuntimeBindings } from "./runtime-env";

export class StripeConfigurationError extends Error {
  constructor() {
    super("Stripe is not configured");
    this.name = "StripeConfigurationError";
  }
}

export type StripeKeyMode = "live" | "test" | "unknown" | "missing";

function normalizeSecret(name: string, raw: string) {
  let value = raw.trim();

  const assignmentPrefix = `${name}=`;
  if (value.startsWith(assignmentPrefix)) {
    value = value.slice(assignmentPrefix.length).trim();
  }

  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1).trim();
  }

  return value;
}

function readSecret(name: "STRIPE_SECRET_KEY" | "STRIPE_WEBHOOK_SECRET") {
  const runtime = getRuntimeBindings();
  const raw = runtime[name] ?? process.env[name];
  return typeof raw === "string" ? normalizeSecret(name, raw) : undefined;
}

export function detectStripeKeyMode(secretKey: string | undefined): StripeKeyMode {
  const value = secretKey?.trim();
  if (!value) return "missing";
  if (/^(?:sk|rk)_live_/.test(value)) return "live";
  if (/^(?:sk|rk)_test_/.test(value)) return "test";
  return "unknown";
}

export function getStripeKeyMode() {
  return detectStripeKeyMode(readSecret("STRIPE_SECRET_KEY"));
}

export function getStripeSecretKey() {
  const secretKey = readSecret("STRIPE_SECRET_KEY");

  if (!secretKey) {
    throw new StripeConfigurationError();
  }

  return secretKey;
}

export function getStripe() {
  return new Stripe(getStripeSecretKey(), {
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
