import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const commerce = fs.readFileSync("app/bag-builder-commerce.tsx", "utf8");
const handoff = fs.readFileSync("app/bag-builder-checkout-handoff.tsx", "utf8");
const snapshot = fs.readFileSync("app/api/configurator/snapshot/route.ts", "utf8");
const checkout = fs.readFileSync("app/api/configurator/checkout/route.ts", "utf8");
const bomResolver = fs.readFileSync("lib/product-configuration-v2-bom.ts", "utf8");
const snapshots = fs.readFileSync("lib/production-snapshots.ts", "utf8");
const resolver = fs.readFileSync("lib/configurator-resolver.ts", "utf8");

test("the configurator source canonically carries every customer selection into V2", () => {
  for (const field of ["family", "color", "stitch", "flap", "handles", "strap", "hardware", "accent"]) {
    assert.match(commerce, new RegExp(`${field}: config\\.${field}`));
    assert.match(handoff, new RegExp(`${field}: config\\.${field}`));
  }
  assert.match(commerce, /schemaVersion: 2/);
  assert.match(commerce, /source: "DIGITAL_CRAFT_TWIN"/);
});

test("server checkout never trusts a client-supplied price or configuration", () => {
  assert.match(checkout, /getProductionSnapshot\(payload\.snapshotId\)/);
  assert.doesNotMatch(checkout, /request\.json\(\).*config/);
  assert.match(checkout, /pricing\.grossCents/);
  assert.match(checkout, /Idempotency-Key/);
  assert.match(checkout, /metadata\[production_package_hash\]/);
});

test("snapshot boundary re-resolves V2 and requires a validated BOM", () => {
  assert.match(snapshot, /isProductConfigurationV2Source\(source\)/);
  assert.match(snapshot, /resolveBomBoundProductConfigurationV2\(/);
  assert.match(snapshot, /resolved\.bomValidation\.status !== "BOM_VALIDATED"/);
  assert.match(snapshot, /persistProductionSnapshot\(resolved\.productionPackagePreview\)/);
  assert.match(snapshot, /snapshot\.packageHash !== resolved\.productionPackageHash/);
});

test("production package hash covers the canonical immutable package", () => {
  assert.match(bomResolver, /configurationHash: base\.configurationHash/);
  assert.match(bomResolver, /configuration: base\.configuration/);
  assert.match(bomResolver, /bom,/);
  assert.match(bomResolver, /productionRecipe:/);
  assert.match(bomResolver, /pricing: base\.pricing/);
  assert.match(bomResolver, /createConfigurationHash\(productionPackagePreview\)/);
  assert.match(snapshots, /createConfigurationHash\(productionPackage\)/);
});

test("configuration hashing is canonical and SHA-256 based", () => {
  assert.match(resolver, /Object\.keys\(record\)\.sort\(\)/);
  assert.match(resolver, /crypto\.subtle\.digest\("SHA-256"/);
});
