import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("required Polish legal pages are present", () => {
  const requiredPages = [
    "app/regulamin/page.tsx",
    "app/polityka-prywatnosci/page.tsx",
    "app/cookies/page.tsx",
    "app/zwroty-i-reklamacje/page.tsx",
    "app/bezpieczenstwo-produktow/page.tsx",
  ];

  for (const page of requiredPages) {
    assert.equal(fs.existsSync(path.join(repoRoot, page)), true, `${page} must exist`);
  }
});

test("production checkout fails closed when legal configuration is incomplete", () => {
  const worker = read("worker/index.ts");
  assert.match(worker, /url\.pathname === "\/api\/checkout"/);
  assert.match(worker, /legalReadinessIssues\(env\)/);
  assert.match(worker, /legal_configuration_incomplete/);
  assert.match(worker, /durable_order_confirmation/);
});

test("VAT display is driven by legal status instead of always claiming 23 percent", () => {
  const vatEnhancer = read("app/vat-display-enhancer.tsx");
  const products = read("lib/products.ts");
  assert.match(vatEnhancer, /vatMode === "active_23"/);
  assert.match(vatEnhancer, /vatMode === "exempt"/);
  assert.match(products, /LEGAL_VAT_MODE/);
  assert.match(products, /vatActive \? VAT_RATE_PERCENT : 0/);
});

test("paid Stripe orders trigger a durable confirmation email", () => {
  const webhook = read("app/api/stripe/webhook/route.ts");
  const email = read("lib/order-email.ts");
  assert.match(webhook, /sendOrderConfirmationEmail\(session\)/);
  assert.match(webhook, /isSuccessfulPaymentEvent && isPaid/);
  assert.match(email, /Idempotency-Key/);
  assert.match(email, /Zachowaj tę wiadomość jako potwierdzenie/);
});

test("public review UI discloses that purchases are not verified", () => {
  const enhancer = read("app/legal-compliance-enhancer.tsx");
  assert.match(enhancer, /zakup nieweryfikowany/);
  assert.match(enhancer, /nie są obecnie weryfikowane na podstawie numeru zamówienia/);
});
