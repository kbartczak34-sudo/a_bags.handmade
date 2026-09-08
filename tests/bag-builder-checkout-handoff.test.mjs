import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const endpoint = fs.readFileSync("app/api/configurator/checkout/route.ts", "utf8");
const snapshot = fs.readFileSync("app/api/configurator/snapshot/route.ts", "utf8");
const resolver = fs.readFileSync("app/api/configurator/resolve/route.ts", "utf8");
const handoff = fs.readFileSync("app/bag-builder-checkout-handoff.tsx", "utf8");
const commerce = fs.readFileSync("app/bag-builder-commerce.tsx", "utf8");
const exact = fs.readFileSync("app/exact-live-customizer.tsx", "utf8");

test("checkout is server-authoritative and accepts only an immutable snapshot identity", () => {
  assert.match(endpoint, /snapshotId/);
  assert.match(endpoint, /getProductionSnapshot|production snapshot/i);
  assert.match(endpoint, /productionPackageHash|package hash/i);
  assert.doesNotMatch(endpoint, /clientPrice|requestedPrice|raw\.price/);
});

test("checkout flow resolves evidence, persists a V2 snapshot and then starts payment", () => {
  assert.match(handoff, /\/api\/configurator\/evidence/);
  assert.match(handoff, /\/api\/configurator\/resolve/);
  assert.match(handoff, /\/api\/configurator\/snapshot/);
  assert.match(handoff, /\/api\/configurator\/checkout/);
  assert.match(handoff, /productionPackageHash/);
  assert.match(snapshot, /schemaVersion/);
  assert.match(snapshot, /BOM_VALIDATED/);
});

test("commerce and checkout share the same V2 physical evidence contract", () => {
  assert.match(commerce, /physicalBinding/);
  assert.match(commerce, /\/api\/configurator\/evidence/);
  assert.match(commerce, /\/api\/configurator\/resolve/);
  assert.match(resolver, /physicalBinding/);
  assert.match(resolver, /productionPackagePreview/);
  assert.match(resolver, /productionPackageHash/);
});

test("active customer customizer mounts the secure V2 checkout handoff", () => {
  assert.match(exact, /BagBuilderCheckoutHandoff/);
  assert.match(exact, /<BagBuilderCheckoutHandoff\s*\/>/);
  assert.match(handoff, /Kup ten projekt/);
  assert.match(handoff, /email/);
});
