import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const catalog = fs.readFileSync("lib/catalog.ts", "utf8");
const products = fs.readFileSync("lib/products.ts", "utf8");
const adminRoute = fs.readFileSync("app/api/admin/products/route.ts", "utf8");
const panel = fs.readFileSync("app/panel/product-panel.tsx", "utf8");
const experience = fs.readFileSync("app/storefront-experience.tsx", "utf8");
const preview = fs.readFileSync("app/product-preview-enhancer.tsx", "utf8");
const checkout = fs.readFileSync("app/api/checkout/route.ts", "utf8");

test("catalog has explicit honest availability states with safe made-to-order default", () => {
  assert.match(catalog, /ProductAvailability = "ready" \| "made_to_order" \| "unavailable"/);
  assert.match(catalog, /Dostępna od ręki/);
  assert.match(catalog, /Na zamówienie/);
  assert.match(catalog, /Chwilowo niedostępna/);
  assert.match(catalog, /availabilityStatus: "made_to_order"/);
});

test("D1 product migration adds availability without claiming existing stock", () => {
  assert.match(products, /availability_status TEXT NOT NULL DEFAULT 'made_to_order'/);
  assert.match(products, /availability_note TEXT NOT NULL DEFAULT ''/);
  assert.match(products, /\["availability_status", "TEXT NOT NULL DEFAULT 'made_to_order'"\]/);
  assert.match(products, /normalizeAvailabilityStatus/);
  assert.match(products, /input\.availabilityStatus \?\? "made_to_order"/);
});

test("owner can manage availability and a truthful lead-time note", () => {
  assert.match(panel, /Dostępność produktu/);
  assert.match(panel, /Termin \/ komunikat dla klientki/);
  assert.match(panel, /availabilityStatus/);
  assert.match(panel, /availabilityNote/);
  assert.match(adminRoute, /availabilityStatuses/);
  assert.match(adminRoute, /availabilityNote\.length > 180/);
});

test("unavailable products remain discoverable but cannot be bought from storefront UI", () => {
  assert.match(experience, /addButton\.disabled = status === "unavailable"/);
  assert.match(experience, /Zapytaj o ponowne wykonanie na WhatsApp/);
  assert.match(preview, /disabled=\{product\.availabilityStatus === "unavailable"\}/);
  assert.match(preview, /if \(!product \|\| product\.availabilityStatus === "unavailable"\) return/);
});

test("checkout rejects stale carts containing an unavailable model before Stripe", () => {
  assert.match(checkout, /product\.availabilityStatus === "unavailable"/);
  assert.match(checkout, /code: "product_unavailable"/);
  assert.match(checkout, /status in checkout|Checkout blocked by product availability/);
  assert.ok(
    checkout.indexOf("product_unavailable") < checkout.indexOf("getStripeSecretKey()"),
    "availability must be checked before Stripe initialization",
  );
});
