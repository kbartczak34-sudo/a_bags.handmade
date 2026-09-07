import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const bindings = fs.readFileSync("lib/craft-color-bindings.ts", "utf8");
const adminRoute = fs.readFileSync("app/api/admin/craft-color-bindings/route.ts", "utf8");
const manager = fs.readFileSync("app/panel/craft-color-binding-manager.tsx", "utf8");
const panel = fs.readFileSync("app/panel/admin-panel.tsx", "utf8");
const boundV2 = fs.readFileSync("lib/product-configuration-v2-color-binding.ts", "utf8");

test("cord-to-builder-color mapping has its own D1 table and closed legacy color vocabulary", () => {
  assert.match(bindings, /CREATE TABLE IF NOT EXISTS craft_cord_builder_colors/);
  assert.match(bindings, /cord_material_id TEXT PRIMARY KEY NOT NULL/);
  assert.match(bindings, /builder_color TEXT NOT NULL/);
  assert.match(bindings, /BUILDER_COLORS/);
  assert.match(bindings, /ON CONFLICT\(cord_material_id\) DO UPDATE/);
});

test("only a validated physical cord can be bound to a builder color", () => {
  assert.match(bindings, /getCraftCalibrationSnapshot/);
  assert.match(bindings, /cord\.status !== "VALIDATED"/);
  assert.match(bindings, /Kolor kreatora można przypisać dopiero do zatwierdzonego materiału sznurka/);
});

test("color mapping API is owner-only and mutable only through explicit PUT", () => {
  assert.match(adminRoute, /isAdminRequest\(request\)/);
  assert.match(adminRoute, /export async function GET/);
  assert.match(adminRoute, /export async function PUT/);
  assert.doesNotMatch(adminRoute, /export async function POST|export async function DELETE/);
  assert.match(adminRoute, /saveCraftCordColorBinding/);
});

test("craft laboratory gives the owner an explicit color-to-SKU mapping UI", () => {
  assert.match(panel, /CraftColorBindingManager/);
  assert.match(manager, /Powiąż kolor kreatora z prawdziwym sznurkiem/);
  assert.match(manager, /Nie dopasowujemy koloru po nazwie ani „na oko”/);
  assert.match(manager, /\/api\/admin\/craft-color-bindings/);
  assert.match(manager, /status === "VALIDATED"/);
});

test("V2 is blocked when physical cord has no color mapping or maps to another selected color", () => {
  assert.match(boundV2, /findCraftCordBuilderColor/);
  assert.match(boundV2, /CORD_COLOR_BINDING_MISSING/);
  assert.match(boundV2, /CORD_COLOR_MISMATCH/);
  assert.match(boundV2, /mappedColor !== configuration\.selection\.color/);
  assert.match(boundV2, /status: "BLOCKED"/);
  assert.match(boundV2, /bodyStatus: "NOT_VALIDATED"/);
  assert.match(boundV2, /resolvedPhysical: null/);
});

test("color-bound V2 preserves the conservative full-product sellability contract", () => {
  assert.match(boundV2, /resolveProductConfigurationV2/);
  assert.doesNotMatch(boundV2, /sellable1to1:\s*true|FULL_PRODUCT_VALIDATED/);
});
