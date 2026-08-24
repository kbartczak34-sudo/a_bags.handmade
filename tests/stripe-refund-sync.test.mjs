import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("orders schema persists refund state with safe migrations", () => {
  const orders = read("lib/orders.ts");
  assert.match(orders, /RefundStatus = "none" \| "partial" \| "full"/);
  assert.match(orders, /refund_status TEXT NOT NULL DEFAULT 'none'/);
  assert.match(orders, /amount_refunded INTEGER NOT NULL DEFAULT 0/);
  assert.match(orders, /refunded_at TEXT/);
  assert.match(orders, /ALTER TABLE orders ADD COLUMN refund_status/);
  assert.match(orders, /ALTER TABLE orders ADD COLUMN amount_refunded/);
  assert.match(orders, /ALTER TABLE orders ADD COLUMN refunded_at/);
});

test("refund events map back to A-Bags orders by PaymentIntent", () => {
  const orders = read("lib/orders.ts");
  assert.match(orders, /recordStripeRefundEvent/);
  assert.match(orders, /WHERE payment_intent_id = \? LIMIT 1/);
  assert.match(orders, /charge\.amount_refunded/);
  assert.match(orders, /charge\.refunded/);
  assert.match(orders, /INSERT OR IGNORE INTO stripe_events/);
});

test("stale out-of-order refund events cannot reduce the stored refunded amount", () => {
  const orders = read("lib/orders.ts");
  assert.match(orders, /previousAmountRefunded = order\.amount_refunded \?\? 0/);
  assert.match(orders, /charge\.amount_refunded < previousAmountRefunded/);
  assert.match(orders, /ignoredAsStale: true/);
});

test("signed Stripe webhook handles charge.refunded", () => {
  const webhook = read("app/api/stripe/webhook/route.ts");
  assert.match(webhook, /event\.type === "charge\.refunded"/);
  assert.match(webhook, /recordStripeRefundEvent\(event, charge\)/);
  assert.match(webhook, /constructEventAsync/);
});

test("owner order panel exposes partial and full refunds", () => {
  const panel = read("app/panel/orders-manager.tsx");
  assert.match(panel, /partial: "Zwrot częściowy"/);
  assert.match(panel, /full: "Zwrot pełny"/);
  assert.match(panel, /formatAmount\(order\.amountRefunded, order\.currency\)/);
  assert.match(panel, /order\.refundStatus !== "none"/);
  assert.match(panel, /order\.refundStatus !== "full"/);
});

test("Stripe live runbook requires charge.refunded subscription", () => {
  const runbook = read("STRIPE-LIVE-GO-LIVE.md");
  assert.match(runbook, /`charge\.refunded`/);
  assert.match(runbook, /partial or full refund/);
});
