import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const bindings = fs.readFileSync("lib/craft-builder-accessory-bindings.ts", "utf8");
const route = fs.readFileSync("app/api/admin/craft-builder-accessory-bindings/route.ts", "utf8");
const manager = fs.readFileSync("app/panel/craft-builder-accessory-binding-manager.tsx", "utf8");
const panel = fs.readFileSync("app/panel/admin-panel.tsx", "utf8");

test("builder accessory mappings are stored separately and unique per slot/value/family", () => {
  assert.match(bindings, /CREATE TABLE IF NOT EXISTS craft_builder_accessory_bindings/);
  assert.match(bindings, /UNIQUE\(slot, builder_value, bag_family\)/);
  assert.match(bindings, /accessory_id TEXT NOT NULL/);
  assert.match(bindings, /mounting_profile_id TEXT NOT NULL/);
  assert.doesNotMatch(bindings, /seedBinding|DEFAULT_BINDING/);
});

test("every builder accessory slot maps to exactly the expected physical accessory kind", () => {
  assert.match(bindings, /flap: "FLAP"/);
  assert.match(bindings, /handles: "HANDLE"/);
  assert.match(bindings, /strap: "STRAP"/);
  assert.match(bindings, /hardware: "HARDWARE"/);
  assert.match(bindings, /accent: "ACCENT"/);
  assert.match(bindings, /accessory\.kind !== SLOT_KINDS\[slot\]/);
});

test("none stays absence of an accessory instead of becoming a fake SKU", () => {
  assert.match(bindings, /builderValue === "none"/);
  assert.match(bindings, /Opcja 'none' nie wymaga fizycznego bindingu akcesorium/);
});

test("mounting binding must belong to the same accessory and bag family", () => {
  assert.match(bindings, /mounting\.accessoryId !== accessoryId/);
  assert.match(bindings, /Profil mocowania należy do innego fizycznego akcesorium/);
  assert.match(bindings, /mounting\.bagFamily !== bagFamily/);
  assert.match(bindings, /Profil mocowania dotyczy innego fasonu/);
});

test("validated mapping requires validated physical accessory and validated mounting", () => {
  assert.match(bindings, /status === "VALIDATED"/);
  assert.match(bindings, /accessory\.status !== expectedStatus/);
  assert.match(bindings, /mounting\.status !== expectedStatus/);
  assert.match(bindings, /Binding można zatwierdzić dopiero dla fizycznie zatwierdzonego akcesorium/);
  assert.match(bindings, /Binding można zatwierdzić dopiero dla fizycznie zatwierdzonego profilu mocowania/);
});

test("binding API is owner-only and server-validates PUT writes", () => {
  assert.match(route, /isAdminRequest\(request\)/);
  assert.match(route, /export async function GET/);
  assert.match(route, /export async function PUT/);
  assert.match(route, /upsertCraftBuilderAccessoryBinding/);
  assert.doesNotMatch(route, /export async function POST|export async function DELETE/);
});

test("owner panel exposes explicit option to SKU to mounting workflow", () => {
  assert.match(panel, /CraftBuilderAccessoryBindingManager/);
  assert.match(manager, /Powiąż opcje kreatora z fizycznymi akcesoriami/);
  assert.match(manager, /System nie dopasowuje akcesoriów po nazwie ani wyglądzie/);
  assert.match(manager, /Agata zatwierdziła ten binding jako dokładne odwzorowanie opcji klienta/);
  assert.match(manager, /availableMountings/);
  assert.match(manager, /item\.accessoryId === accessoryId && item\.bagFamily === family/);
});
