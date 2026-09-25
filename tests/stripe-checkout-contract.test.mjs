import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("Stripe Checkout keeps payment methods dynamic and tracked", () => {
  const checkout = read("app/api/checkout/route.ts");

  assert.doesNotMatch(checkout, /payment_method_types/);
  assert.doesNotMatch(checkout, /payment_choice/);
  assert.match(checkout, /integration_identifier/);
  assert.match(checkout, /Array\.from\(\{ length: 8 \}/);
  assert.match(checkout, /abags_checkout_\$\{integrationSuffix\}/);
});

test("store checkout uses the fixed Polish delivery fee without a free-shipping threshold", () => {
  const checkout = read("app/api/checkout/route.ts");

  assert.match(checkout, /standardShippingAmount/);
  assert.match(checkout, /shipping_options\[0\]\[shipping_rate_data\]\[fixed_amount\]\[currency\]/);
  assert.match(checkout, /shipping_options\[0\]\[shipping_rate_data\]\[display_name\].*Dostawa w Polsce/);
});
