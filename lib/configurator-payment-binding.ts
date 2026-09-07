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

  const paymentIntentMetadata = await readPaymentIntentMetadata(session);
  if (paymentIntentMetadata) {
    if (paymentIntentMetadata.checkout_type !== "CONFIGURATOR_V2"
      || paymentIntentMetadata.snapshot_id !== snapshotId
      || paymentIntentMetadata.production_package_hash?.trim().toLowerCase() !== packageHash) {
      throw new Error("PaymentIntent nie jest zgodny z Production Snapshot.");
    }
  }

  return { snapshotId, productionPackageHash: packageHash } satisfies ConfiguratorPaymentBinding;
}

async function readPaymentIntentMetadata(session: Stripe.Checkout.Session) {
  const paymentIntent = session.payment_intent;
  if (!paymentIntent) return null;

  const stripe = await import("./stripe").then((module) => module.getStripe());
  const paymentIntentId = typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id;
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  return intent.metadata ?? null;
}
