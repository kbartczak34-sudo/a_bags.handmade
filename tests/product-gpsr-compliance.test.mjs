import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("product schema migrates GPSR fields without inventing product data", () => {
  const products = read("lib/products.ts");
  assert.match(products, /product_identifier TEXT NOT NULL DEFAULT ''/);
  assert.match(products, /batch_code TEXT NOT NULL DEFAULT ''/);
  assert.match(products, /materials TEXT NOT NULL DEFAULT ''/);
  assert.match(products, /care_instructions TEXT NOT NULL DEFAULT ''/);
  assert.match(products, /safety_info TEXT NOT NULL DEFAULT ''/);
  assert.match(products, /PRAGMA table_info\(products\)/);
  assert.match(products, /ALTER TABLE products ADD COLUMN/);
});

test("owner has a protected editor for per-product compliance data", () => {
  const route = read("app/api/admin/product-compliance/route.ts");
  const manager = read("app/panel/product-compliance-manager.tsx");
  const panel = read("app/panel/admin-panel.tsx");
  assert.match(route, /isAdminRequest\(request\)/);
  assert.match(route, /updateProductCompliance/);
  assert.match(manager, /Identyfikator produktu/);
  assert.match(manager, /Materiały i komponenty/);
  assert.match(manager, /Informacje bezpieczeństwa/);
  assert.match(panel, /GPSR produktów/);
  assert.match(panel, /<ProductComplianceManager \/>/);
});

test("checkout fails closed when selected product compliance is incomplete", () => {
  const checkout = read("app/api/checkout/route.ts");
  assert.match(checkout, /productComplianceComplete/);
  assert.match(checkout, /product_compliance_incomplete/);
  assert.match(checkout, /productIdentifier\.trim\(\)/);
  assert.match(checkout, /materials\.trim\(\)/);
  assert.match(checkout, /careInstructions\.trim\(\)/);
  assert.match(checkout, /safetyInfo\.trim\(\)/);
});

test("Stripe promotion codes remain disabled until price-history support exists", () => {
  const checkout = read("app/api/checkout/route.ts");
  assert.doesNotMatch(checkout, /form\.set\("allow_promotion_codes"/);
  assert.match(checkout, /price-history mechanism/);
});

test("storefront exposes real product compliance data and configured VAT label", () => {
  const enhancer = read("app/product-compliance-enhancer.tsx");
  const preview = read("app/product-preview-enhancer.tsx");
  const layout = read("app/layout.tsx");
  assert.match(enhancer, /productIdentifier/);
  assert.match(enhancer, /careInstructions/);
  assert.match(enhancer, /safetyInfo/);
  assert.match(enhancer, /status\.vatLabel/);
  assert.match(layout, /<ProductComplianceEnhancer \/>/);
  assert.doesNotMatch(preview, /Cena brutto · zawiera VAT 23%/);
  assert.doesNotMatch(preview, /Wykonywana na zamówienie/);
  assert.doesNotMatch(preview, /Produkt handmade wykonywany na zamówienie/);
});

test("readiness dashboard includes actual visible-product compliance completeness", () => {
  const route = read("app/api/admin/status/route.ts");
  const view = read("app/panel/store-status.tsx");
  assert.match(route, /productCompliance/);
  assert.match(route, /visibleProducts/);
  assert.match(route, /productCompliance\.ready/);
  assert.match(view, /Dane GPSR widocznych produktów/);
  assert.match(view, /completeVisible/);
});
