import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const legacyCheckout = readFileSync("app/api/bag-builder-checkout/route.ts", "utf8");
const commerce = readFileSync("app/bag-builder-commerce.tsx", "utf8");
const handoff = readFileSync("app/bag-builder-checkout-handoff.tsx", "utf8");
const checkout = readFileSync("app/api/configurator/checkout/route.ts", "utf8");
const snapshot = readFileSync("app/api/configurator/snapshot/route.ts", "utf8");

test("legacy builder checkout cannot create a payment session", () => {
  assert.match(legacyCheckout, /LEGACY_BUILDER_CHECKOUT_RETIRED/);
  assert.match(legacyCheckout, /status:\s*410/);
  assert.match(legacyCheckout, /\/api\/configurator\/checkout/);
  assert.doesNotMatch(legacyCheckout, /api\.stripe\.com\/v1\/checkout\/sessions/);
});

test("customer checkout is gated by the complete V2 production package", () => {
  assert.match(commerce, /const packageReady = typeof resolved\.productionPackageHash === "string"/);
  assert.match(commerce, /const fullyReady = validationMatch && packageReady && priceMatch/);
  assert.match(commerce, /const serverReady = serverStatus === "validated"[\s\S]*Boolean\(productionPackageHash\)/);
  assert.match(handoff, /resolved\.validation\?\.valid !== true \|\| !resolved\.productionPackagePreview \|\| !resolved\.productionPackageHash/);
});

test("immutable snapshot is required before configurator checkout", () => {
  assert.match(snapshot, /isProductConfigurationV2Source\(source\)/);
  assert.match(snapshot, /productionPackagePreview/);
  assert.match(snapshot, /productionPackageHash/);
  assert.match(snapshot, /BOM_VALIDATED/);
  assert.match(snapshot, /persistProductionSnapshot/);
  assert.match(checkout, /getProductionSnapshot\(payload\.snapshotId\)/);
  assert.match(checkout, /pricing\.status !== "AVAILABLE"/);
  assert.match(checkout, /metadata\]\[production_package_hash/);
});

test("checkout never trusts a client-supplied amount", () => {
  assert.doesNotMatch(checkout, /payload\.amount/);
  assert.doesNotMatch(checkout, /payload\.price/);
  assert.match(checkout, /pricing\.grossCents/);
  assert.match(checkout, /unit_amount\", String\(pricing\.grossCents\)/);
});
