import type Stripe from "stripe";
import { createConfigurationHash } from "./configurator-resolver";
import { getProductionSnapshot } from "./production-snapshots";

export type ConfiguratorPaymentBinding = {
  snapshotId: string;
  productionPackageHash: string;
};

function validHash(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value.trim().toLowerCase());
}

function validSnapshotId(value: unknown): value is string {
  return typeof value === "string" && /^ps_[0-9a-f-]{36}$/.test(value.trim());
}

function snapshotGrossCents(snapshotPackage: unknown) {
  if (typeof snapshotPackage !== "object" || snapshotPackage === null || Array.isArray(snapshotPackage)) return null;
  const pricing = (snapshotPackage as Record<string, unknown>).pricing;
  if (typeof pricing !== "object" || pricing === null || Array.isArray(pricing)) return null;
  const grossCents = (pricing as Record<string, unknown>).grossCents;
  const currency = (pricing as Record<string, unknown>).currency;
  if (currency !== "PLN" || !Number.isInteger(grossCents) || (grossCents as number) < 1) return null;
  return grossCents as number;
}

export async function verifyConfiguratorPaymentBinding(session: Stripe.Checkout.Session) {
  const metadata = session.metadata ?? {};
  if (metadata.checkout_type !== "CONFIGURATOR_V2") return null;

  const snapshotId = metadata.snapshot_id?.trim();
  const packageHash = metadata.production_package_hash?.trim().toLowerCase();
  if (!validSnapshotId(snapshotId) || !validHash(packageHash)) {
    throw new Error("Brak prawidłowego powiązania Production Snapshot w płatności.");
  }

  const snapshot = await getProductionSnapshot(snapshotId);
  if (!snapshot) throw new Error("Production Snapshot powiązany z płatnością nie istnieje.");
  if (snapshot.packageHash !== packageHash) {
    throw new Error("Hash Production Snapshot nie odpowiada metadanym płatności.");
  }

  const recalculatedHash = await createConfigurationHash(snapshot.package);
  if (recalculatedHash !== snapshot.packageHash) {
    throw new Error("Integralność Production Snapshot została naruszona.");
  }

  const snapshotGross = snapshotGrossCents(snapshot.package);
  if (snapshotGross === null) throw new Error("Production Snapshot nie zawiera prawidłowej ceny PLN.");

  const sessionShipping = session.shipping_cost?.amount_total ?? 0;
  if (!Number.isInteger(sessionShipping) || sessionShipping < 0) {
    throw new Error("Checkout Session zawiera nieprawidłowy koszt dostawy.");
  }
  const expectedSessionTotal = snapshotGross + sessionShipping;
  if (session.currency?.toLowerCase() !== "pln" || session.amount_total !== expectedSessionTotal) {
    throw new Error("Kwota lub waluta płatności nie odpowiada Production Snapshot.");
  }

  const paymentIntentMetadata = await readPaymentIntentMetadata(session, snapshotId, packageHash);
  if (paymentIntentMetadata.checkout_type !== "CONFIGURATOR_V2"
    || paymentIntentMetadata.snapshot_id !== snapshotId
    || paymentIntentMetadata.production_package_hash?.trim().toLowerCase() !== packageHash) {
    throw new Error("PaymentIntent nie jest zgodny z Production Snapshot.");
  }

  return { snapshotId, productionPackageHash: packageHash } satisfies ConfiguratorPaymentBinding;
}

async function readPaymentIntentMetadata(
  session: Stripe.Checkout.Session,
  snapshotId: string,
  packageHash: string,
) {
  const paymentIntent = session.payment_intent;
  if (!paymentIntent) throw new Error("Checkout Session nie ma powiązanego PaymentIntent.");

  const stripe = await import("./stripe").then((module) => module.getStripe());
  const paymentIntentId = typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id;
  if (!paymentIntentId) throw new Error("Checkout Session zawiera nieprawidłowy PaymentIntent.");

  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (intent.amount !== session.amount_total || intent.currency?.toLowerCase() !== "pln") {
    throw new Error("PaymentIntent nie ma kwoty zgodnej z Checkout Session.");
  }

  const metadata = intent.metadata ?? {};
  if (metadata.checkout_type !== "CONFIGURATOR_V2"
    || metadata.snapshot_id !== snapshotId
    || metadata.production_package_hash?.trim().toLowerCase() !== packageHash) {
    throw new Error("PaymentIntent nie jest zgodny z Production Snapshot.");
  }

  return metadata;
}
