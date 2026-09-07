import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const route = fs.readFileSync("app/api/configurator/checkout/route.ts", "utf8");

test("configurator checkout requires an existing server-side Production Snapshot", () => {
  assert.match(route, /getProductionSnapshot\(payload\.snapshotId\)/);
  assert.match(route, /PRODUCTION_SNAPSHOT_NOT_FOUND/);
  assert.match(route, /snapshot\.package/);
  assert.doesNotMatch(route, /productionPackage.*request\.json/);
});

test("configurator checkout uses snapshot pricing rather than client-supplied price", () => {
  assert.match(route, /pricing\.grossCents/);
  assert.match(route, /line_items\[0\]\[price_data\]\[unit_amount\]/);
  assert.doesNotMatch(route, /value\.grossCents/);
  assert.doesNotMatch(route, /value\.price/);
});

test("configurator checkout binds immutable snapshot identity to Stripe", () => {
  assert.match(route, /metadata\[checkout_type\].*CONFIGURATOR_V2/);
  assert.match(route, /metadata\[snapshot_id\]/);
  assert.match(route, /metadata\[production_package_hash\]/);
  assert.match(route, /payment_intent_data\[metadata\]\[snapshot_id\]/);
  assert.match(route, /payment_intent_data\[metadata\]\[production_package_hash\]/);
});

test("configurator checkout does not accept a client-authoritative package or hash", () => {
  assert.doesNotMatch(route, /value\.productionPackage/);
  assert.doesNotMatch(route, /value\.productionPackageHash/);
  assert.doesNotMatch(route, /value\.packageHash/);
});
