import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const helper = fs.readFileSync("lib/configurator-payment-binding.ts", "utf8");
const webhook = fs.readFileSync("app/api/stripe/webhook/route.ts", "utf8");
const orders = fs.readFileSync("lib/orders.ts", "utf8");

test("configurator payment binding validates the server-side snapshot identity", () => {
  assert.match(helper, /CONFIGURATOR_V2/);
  assert.match(helper, /validSnapshotId/);
  assert.match(helper, /validHash/);
  assert.match(helper, /getProductionSnapshot\(snapshotId\)/);
  assert.match(helper, /snapshot\.packageHash !== packageHash/);
});

test("configurator payment binding validates immutable snapshot integrity", () => {
  assert.match(helper, /createConfigurationHash\(snapshot\.package\)/);
  assert.match(helper, /recalculatedHash !== snapshot\.packageHash/);
});

test("configurator payment binding validates authoritative PLN amount including shipping", () => {
  assert.match(helper, /snapshotGrossCents/);
  assert.match(helper, /session\.shipping_cost\?\.amount_total/);
  assert.match(helper, /expectedSessionTotal/);
  assert.match(helper, /session\.amount_total !== expectedSessionTotal/);
  assert.match(helper, /currency\?\.toLowerCase\(\) !== "pln"/);
});

test("configurator payment binding fails closed for a missing or mismatched PaymentIntent", () => {
  assert.match(helper, /if \(!paymentIntent\)/);
  assert.match(helper, /paymentIntents\.retrieve/);
  assert.match(helper, /intent\.amount !== session\.amount_total/);
  assert.match(helper, /PaymentIntent nie jest zgodny z Production Snapshot/);
  assert.match(helper, /metadata\.snapshot_id !== snapshotId/);
  assert.match(helper, /metadata\.production_package_hash/);
});

test("webhook verifies configurator binding only on the paid-success path", () => {
  assert.match(
    webhook,
    /if \(isSuccessfulPaymentEvent && isPaid\) \{\s*const binding = await verifyConfiguratorPaymentBinding\(session\)/s,
  );
  assert.match(webhook, /if \(!binding\)/);
});

test("webhook performs binding verification before paid order side effects", () => {
  const verification = webhook.indexOf("verifyConfiguratorPaymentBinding(session)");
  const orderRecord = webhook.indexOf("recordStripeOrderEvent(event, session)");
  const paidSnapshot = webhook.indexOf("recordPaidOrderConfigurationSnapshot(session)");
  assert.ok(verification >= 0);
  assert.ok(orderRecord > verification);
  assert.ok(paidSnapshot > verification);
});

test("paid duplicate Stripe events cannot repeat order side effects", () => {
  assert.match(orders, /INSERT OR IGNORE INTO stripe_events/);
  assert.match(orders, /return \{ created: \(eventInsert\.meta\?\.changes \?\? 0\) > 0 \}/);
  const orderRecord = webhook.indexOf("const orderEvent = await recordStripeOrderEvent(event, session)");
  const duplicateGuard = webhook.indexOf("if (!orderEvent.created)");
  const paidSnapshot = webhook.indexOf("recordPaidOrderConfigurationSnapshot(session)");
  assert.ok(orderRecord >= 0);
  assert.ok(duplicateGuard > orderRecord);
  assert.ok(paidSnapshot > duplicateGuard);
});

test("failed and expired Stripe events do not require a Production Snapshot binding", () => {
  const configuratorBlock = webhook.match(
    /if \(session\.metadata\.checkout_type === "CONFIGURATOR_V2"\) \{([\s\S]*?)\n        \}/,
  )?.[1] ?? "";
  assert.match(configuratorBlock, /isSuccessfulPaymentEvent && isPaid/);
});
