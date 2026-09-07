import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const bom = fs.readFileSync("lib/product-configuration-v2-bom.ts", "utf8");
const route = fs.readFileSync("app/api/configurator/resolve/route.ts", "utf8");

test("BOM requires a validated production recipe and physical body evidence", () => {
  assert.match(bom, /base\.productionRecipeValidation\.status !== "PRODUCTION_RECIPE_VALIDATED"/);
  assert.match(bom, /PRODUCTION_RECIPE_REQUIRED_FOR_BOM/);
  assert.match(bom, /if \(!base\.resolvedPhysical\)/);
  assert.match(bom, /BODY_EVIDENCE_REQUIRED_FOR_BOM/);
});

test("cord BOM uses exact Golden Master actual consumption without invented waste", () => {
  assert.match(bom, /base\.resolvedPhysical\.goldenMaster\.actualCordUsedMm/);
  assert.match(bom, /quantity: actualCordUsedMm \/ 1000/);
  assert.match(bom, /source: "GOLDEN_MASTER_ACTUAL_USAGE"/);
  assert.doesNotMatch(bom, /waste|reserve|allowance|\+\s*0\.1|\*\s*1\.1/i);
});

test("every resolved accessory requires exact validated BOM usage by binding id", () => {
  assert.match(bom, /for \(const resolved of base\.accessoryValidation\.resolved\)/);
  assert.match(bom, /item\.bindingId === resolved\.bindingId/);
  assert.match(bom, /usage\.status === "VALIDATED"/);
  assert.match(bom, /usage\.quantity > 0/);
  assert.match(bom, /BOM_USAGE_NOT_VALIDATED_/);
});

test("accessory BOM keeps exact SKU, physical binding, mounting, quantity and unit", () => {
  assert.match(bom, /bindingId: resolved\.bindingId/);
  assert.match(bom, /accessoryId: resolved\.accessory\.id/);
  assert.match(bom, /mountingProfileId: resolved\.mounting\.id/);
  assert.match(bom, /sku: resolved\.accessory\.sku/);
  assert.match(bom, /quantity: usage!\.quantity/);
  assert.match(bom, /unit: usage!\.unit/);
});

test("BOM must cover every active accessory selection", () => {
  assert.match(bom, /expectedAccessoryCount = base\.accessoryValidation\.requiredSlots\.length/);
  assert.match(bom, /accessoryItems\.length !== expectedAccessoryCount/);
  assert.match(bom, /BOM_ACCESSORY_COVERAGE_INCOMPLETE/);
});

test("production package preview is deterministic and hashed with the canonical SHA-256 helper", () => {
  assert.match(bom, /productionPackagePreview/);
  assert.match(bom, /configurationHash: base\.configurationHash/);
  assert.match(bom, /compiledSteps: base\.productionRecipeValidation\.compiledSteps/);
  assert.match(bom, /pricing: base\.pricing/);
  assert.match(bom, /createConfigurationHash\(productionPackagePreview\)/);
  assert.match(bom, /productionPackageHash/);
});

test("validated BOM advances only to server snapshot persistence boundary", () => {
  assert.match(bom, /BOM_VALIDATED/);
  assert.match(bom, /PRODUCTION_SNAPSHOT_NOT_PERSISTED/);
  assert.match(bom, /immutable Production Snapshot/i);
  assert.doesNotMatch(bom, /sellable1to1:\s*true/);
});

test("public V2 route loads explicit BOM usage fail-closed", () => {
  assert.match(route, /getCraftAccessoryBomUsage/);
  assert.match(route, /resolveBomBoundProductConfigurationV2/);
  assert.match(route, /PHYSICAL_EVIDENCE_UNAVAILABLE/);
  assert.match(route, /Promise\.all/);
});
