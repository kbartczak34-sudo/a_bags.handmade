import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const helper = fs.readFileSync("lib/configurator-payment-binding.ts", "utf8");
const webhook = fs.readFileSync("app/api/stripe/webhook/route.ts", "utf8");

test("configurator payment binding validates the server-side snapshot", () => {
  assert.match(helper, /getProductionSnapshot\(snapshotId\)/);
  assert.match(helper, /snapshot\.packageHash !== packageHash/);
  assert.match(helper, /createConfigurationHash\(snapshot\.package\)/);
});

test("configurator payment binding validates PaymentIntent metadata", () => {
  assert.match(helper, /paymentIntents\.retrieve/);
  assert.match(helper, /checkout_type !== \"CONFIGURATOR_V2\"/);
  assert.match(helper, /snapshot_id !== snapshotId/);
  assert.match(helper, /production_package_hash/);
});

test("webhook verifies configurator binding before recording the Stripe order event", () => {
  assert.match(webhook, /verifyConfiguratorPaymentBinding\(session\)/);
  const verification = webhook.indexOf("verifyConfiguratorPaymentBinding(session)");
  const orderRecord = webhook.indexOf("recordStripeOrderEvent(event, session)");
  assert.ok(verification >= 0 && orderRecord > verification);
});
