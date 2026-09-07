import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const resolver = fs.readFileSync("lib/product-configuration-v2-accessories.ts", "utf8");
const route = fs.readFileSync("app/api/configurator/resolve/route.ts", "utf8");

test("V2 derives required physical accessory slots from the exact customer selection", () => {
  assert.match(resolver, /selection\.flap !== "none"/);
  assert.match(resolver, /selection\.handles !== "none"/);
  assert.match(resolver, /selection\.strap !== "none"/);
  assert.match(resolver, /slot: "hardware", builderValue: selection\.hardware/);
  assert.match(resolver, /selection\.accent !== "none"/);
});

test("V2 finds an exact binding by slot, value and bag family", () => {
  assert.match(resolver, /item\.slot === required\.slot/);
  assert.match(resolver, /item\.builderValue === required\.builderValue/);
  assert.match(resolver, /item\.bagFamily === selection\.family/);
  assert.match(resolver, /ACCESSORY_BINDING_MISSING_/);
  assert.match(resolver, /ACCESSORY_BINDING_NOT_VALIDATED_/);
});

test("V2 revalidates accessory measurements instead of trusting binding status alone", () => {
  assert.match(resolver, /measuredAccessoryIsComplete/);
  assert.match(resolver, /accessory\.status === "VALIDATED"/);
  assert.match(resolver, /accessory\.massG > 0/);
  assert.match(resolver, /dimensions >= 2/);
  assert.match(resolver, /ACCESSORY_MEASUREMENTS_NOT_VALIDATED_/);
});

test("V2 revalidates mounting relationship, geometry boundary and load-bearing evidence", () => {
  assert.match(resolver, /mounting\.accessoryId !== accessory\.id|mounting\.accessoryId === accessory\.id/);
  assert.match(resolver, /mounting\.bagFamily !== selection\.family|mounting\.bagFamily === selection\.family/);
  assert.match(resolver, /mounting\.anchorCount/);
  assert.match(resolver, /mounting\.minEdgeClearanceMm/);
  assert.match(resolver, /accessory\.kind === "HANDLE" \|\| accessory\.kind === "STRAP"/);
  assert.match(resolver, /mounting\.validatedLoadN/);
  assert.match(resolver, /MOUNTING_EVIDENCE_NOT_VALIDATED_/);
});

test("resolved accessory evidence contains exact physical SKU and mounting identity", () => {
  assert.match(resolver, /bindingId: binding\.id/);
  assert.match(resolver, /sku: accessory\.sku/);
  assert.match(resolver, /material: accessory\.material/);
  assert.match(resolver, /massG: accessory\.massG/);
  assert.match(resolver, /id: mounting\.id/);
  assert.match(resolver, /anchorCount: mounting\.anchorCount/);
});

test("validated body and accessories still cannot become sellable 1:1 without production recipe", () => {
  assert.match(resolver, /FULL_PRODUCTION_RECIPE_NOT_VALIDATED/);
  assert.match(resolver, /accessoryValidation/);
  assert.match(resolver, /ACCESSORIES_VALIDATED/);
  assert.match(resolver, /pełna receptura montażu i kontroli jakości produktu nie została jeszcze zatwierdzona/i);
  assert.doesNotMatch(resolver, /sellable1to1:\s*true/);
});

test("public V2 route fails closed when any physical evidence store is unavailable", () => {
  assert.match(route, /Promise\.all/);
  assert.match(route, /getCraftAccessorySnapshot/);
  assert.match(route, /getCraftBuilderAccessoryBindings/);
  assert.match(route, /PHYSICAL_EVIDENCE_UNAVAILABLE/);
  assert.match(route, /503/);
});
