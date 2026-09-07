import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const snapshot = fs.readFileSync("lib/order-configuration-snapshots.ts", "utf8");
const webhook = fs.readFileSync("app/api/stripe/webhook/route.ts", "utf8");
const checkout = fs.readFileSync("app/api/bag-builder-checkout/route.ts", "utf8");

test("paid configured orders are frozen in a dedicated immutable D1 snapshot table", () => {
  assert.match(snapshot, /CREATE TABLE IF NOT EXISTS order_configuration_snapshots/);
  assert.match(snapshot, /session_id TEXT PRIMARY KEY NOT NULL/);
  assert.match(snapshot, /configuration_hash TEXT NOT NULL/);
  assert.match(snapshot, /config_json TEXT NOT NULL/);
  assert.match(snapshot, /INSERT OR IGNORE INTO order_configuration_snapshots/);
  assert.doesNotMatch(snapshot, /UPDATE order_configuration_snapshots/);
  assert.doesNotMatch(snapshot, /ON CONFLICT\(session_id\) DO UPDATE/);
});

test("snapshot creation is limited to paid sessions and keeps pre-hash legacy orders compatible", () => {
  assert.match(snapshot, /session\.payment_status === "paid"/);
  assert.match(snapshot, /session\.payment_status === "no_payment_required"/);
  assert.match(snapshot, /reason: "not_paid"/);
  assert.match(snapshot, /reason: "legacy_session"/);
});

test("snapshot verifies server-created SHA-256 hash against the stored project before persistence", () => {
  assert.match(snapshot, /toProductConfigurationV1\(parsed\)/);
  assert.match(snapshot, /createConfigurationHash\(configuration\)/);
  assert.match(snapshot, /calculatedHash !== storedHash/);
  assert.match(snapshot, /\^\[a-f0-9\]\{64\}\$/);
  assert.match(checkout, /metadata\[builder_configuration_hash\]/);
  assert.doesNotMatch(snapshot, /metadata\?\.builder_configuration_hash[^\n]*as ProductConfigurationV1/);
});

test("snapshot freezes product identity, real-photo mode and paid amount without exposing a mutable update API", () => {
  assert.match(snapshot, /project_code TEXT/);
  assert.match(snapshot, /catalog_id TEXT/);
  assert.match(snapshot, /photo_true INTEGER/);
  assert.match(snapshot, /amount_total INTEGER/);
  assert.match(snapshot, /currency TEXT/);
  assert.match(snapshot, /getOrderConfigurationSnapshot/);
  assert.doesNotMatch(snapshot, /updateOrderConfigurationSnapshot/);
});

test("Stripe webhook records the immutable snapshot only in the successful paid branch", () => {
  assert.match(webhook, /recordPaidOrderConfigurationSnapshot/);
  assert.match(webhook, /if \(isSuccessfulPaymentEvent && isPaid\) \{/);
  const paidBranch = webhook.slice(
    webhook.indexOf("if (isSuccessfulPaymentEvent && isPaid)"),
    webhook.indexOf('console.info("Stripe order event persisted"'),
  );
  assert.match(paidBranch, /recordPaidOrderConfigurationSnapshot\(session\)/);
});
