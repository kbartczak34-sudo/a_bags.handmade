import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("runtime exposes an explicit Stripe live webhook confirmation flag", () => {
  const runtime = read("lib/runtime-env.ts");
  const worker = read("worker/index.ts");
  assert.match(runtime, /STRIPE_LIVE_WEBHOOK_CONFIRMED\?: string/);
  assert.match(worker, /STRIPE_LIVE_WEBHOOK_CONFIRMED\?: string/);
  assert.match(worker, /STRIPE_LIVE_WEBHOOK_CONFIRMED: env\.STRIPE_LIVE_WEBHOOK_CONFIRMED/);
});

test("Stripe live webhook readiness requires both a secret and operator confirmation", () => {
  const stripe = read("lib/stripe.ts");
  assert.match(stripe, /isStripeLiveWebhookConfirmed/);
  assert.match(stripe, /isStripeLiveWebhookReady/);
  assert.match(stripe, /readSecret\("STRIPE_WEBHOOK_SECRET"\)/);
  assert.match(stripe, /readRuntimeFlag\("STRIPE_LIVE_WEBHOOK_CONFIRMED"\)/);
});

test("production checkout fails closed until the live webhook is confirmed", () => {
  const checkout = read("app/api/checkout/route.ts");
  assert.match(checkout, /isStripeLiveWebhookReady/);
  assert.match(checkout, /isProductionHost && !isStripeLiveWebhookReady\(\)/);
  assert.match(checkout, /stripe_live_webhook_required/);
});

test("owner status reports live webhook confirmation separately", () => {
  const route = read("app/api/admin/status/route.ts");
  const view = read("app/panel/store-status.tsx");
  assert.match(route, /webhookReady: isStripeLiveWebhookReady\(\)/);
  assert.match(route, /liveWebhookConfirmed,/);
  assert.match(view, /liveWebhookConfirmed: boolean/);
  assert.match(view, /live \$\{status\.liveWebhookConfirmed \? "potwierdzony" : "niepotwierdzony"\}/);
});
