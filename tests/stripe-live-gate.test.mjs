import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("Stripe key mode detection distinguishes live, test and missing keys", () => {
  const stripe = read("lib/stripe.ts");
  assert.match(stripe, /StripeKeyMode = "live" \| "test" \| "unknown" \| "missing"/);
  assert.match(stripe, /\^\(\?:sk\|rk\)_live_/);
  assert.match(stripe, /\^\(\?:sk\|rk\)_test_/);
  assert.match(stripe, /return "missing"/);
});

test("production checkout requires Stripe live mode", () => {
  const checkout = read("app/api/checkout/route.ts");
  assert.match(checkout, /abagshandmade\.pl/);
  assert.match(checkout, /www\.abagshandmade\.pl/);
  assert.match(checkout, /detectStripeKeyMode\(secretKey\)/);
  assert.match(checkout, /isProductionHost && stripeMode !== "live"/);
  assert.match(checkout, /stripe_live_required/);
});

test("owner readiness dashboard exposes Stripe mode without exposing the key", () => {
  const route = read("app/api/admin/status/route.ts");
  const view = read("app/panel/store-status.tsx");
  assert.match(route, /stripeReady: stripeMode === "live"/);
  assert.match(route, /stripeMode,/);
  assert.match(view, /tryb \$\{readableStripeMode\(status\.stripeMode\)\}/);
  assert.match(view, /if \(value === "live"\) return "LIVE"/);
  assert.doesNotMatch(route, /secretKey/);
});
