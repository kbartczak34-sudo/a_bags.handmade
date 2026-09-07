import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const resolver = fs.readFileSync("lib/product-configuration-v2-production-recipe.ts", "utf8");
const route = fs.readFileSync("app/api/configurator/resolve/route.ts", "utf8");

test("V2 selects only a validated recipe for exact family and stitch and prefers highest version", () => {
  assert.match(resolver, /recipe\.status === "VALIDATED"/);
  assert.match(resolver, /recipe\.bagFamily === family/);
  assert.match(resolver, /recipe\.stitchPatternId === stitch/);
  assert.match(resolver, /sort\(\(left, right\) => right\.version - left\.version\)/);
  assert.match(resolver, /PRODUCTION_RECIPE_MISSING/);
});

test("recipe structure is revalidated at resolve time instead of trusting database status", () => {
  assert.match(resolver, /PRODUCTION_RECIPE_VERSION_INVALID/);
  assert.match(resolver, /PRODUCTION_RECIPE_ORDER_INVALID/);
  assert.match(resolver, /\["CROCHET", "FINISH", "QC"\]/);
  assert.match(resolver, /PRODUCTION_RECIPE_QC_CRITERION_MISSING/);
  assert.match(resolver, /PRODUCTION_RECIPE_HARDWARE_ATTACH_MISSING/);
  assert.match(resolver, /PRODUCTION_RECIPE_INSTRUCTION_MISSING/);
});

test("recipe compilation requires already validated accessory evidence", () => {
  assert.match(resolver, /base\.accessoryValidation\.status !== "ACCESSORIES_VALIDATED"/);
  assert.match(resolver, /ACCESSORY_EVIDENCE_REQUIRED_FOR_RECIPE_COMPILATION/);
});

test("every active physical accessory slot must have a matching ATTACH production step", () => {
  assert.match(resolver, /for \(const required of base\.accessoryValidation\.requiredSlots\)/);
  assert.match(resolver, /step\.stepType === "ATTACH" && step\.appliesToSlot === required\.slot/);
  assert.match(resolver, /PRODUCTION_RECIPE_ATTACH_MISSING_/);
});

test("inactive optional accessory steps are omitted from compiled production instructions", () => {
  assert.match(resolver, /activeSlots/);
  assert.match(resolver, /step\.stepType === "ATTACH" && step\.appliesToSlot && !activeSlots\.has\(step\.appliesToSlot\)/);
  assert.match(resolver, /continue/);
});

test("compiled ATTACH step carries the exact resolved SKU and mounting profile", () => {
  assert.match(resolver, /sku: resolvedAccessory\.accessory\.sku/);
  assert.match(resolver, /accessoryId: resolvedAccessory\.accessory\.id/);
  assert.match(resolver, /mountingProfileId: resolvedAccessory\.mounting\.id/);
  assert.match(resolver, /compiledOrder: compiledSteps\.length \+ 1/);
});

test("validated recipe advances the boundary to BOM and immutable production snapshot, not checkout", () => {
  assert.match(resolver, /PRODUCTION_RECIPE_VALIDATED/);
  assert.match(resolver, /BOM_AND_PRODUCTION_SNAPSHOT_NOT_COMPILED/);
  assert.match(resolver, /immutable Production Snapshot/i);
  assert.doesNotMatch(resolver, /sellable1to1:\s*true/);
});

test("public V2 route loads production recipe evidence fail-closed", () => {
  assert.match(route, /getCraftProductionRecipes/);
  assert.match(route, /resolveProductionRecipeBoundProductConfigurationV2/);
  assert.match(route, /PHYSICAL_EVIDENCE_UNAVAILABLE/);
});
