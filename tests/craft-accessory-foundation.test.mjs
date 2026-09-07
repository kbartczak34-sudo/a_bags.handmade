import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const accessories = fs.readFileSync("lib/craft-accessories.ts", "utf8");
const route = fs.readFileSync("app/api/admin/craft-accessories/route.ts", "utf8");
const manager = fs.readFileSync("app/panel/craft-accessory-manager.tsx", "utf8");
const panel = fs.readFileSync("app/panel/admin-panel.tsx", "utf8");

test("accessory laboratory creates dedicated empty D1 evidence tables", () => {
  assert.match(accessories, /CREATE TABLE IF NOT EXISTS craft_accessories/);
  assert.match(accessories, /CREATE TABLE IF NOT EXISTS craft_mounting_profiles/);
  assert.match(accessories, /sku TEXT NOT NULL UNIQUE/);
  assert.match(accessories, /validated_load_n REAL/);
  assert.doesNotMatch(accessories, /seedAccessory|seedMounting|DEFAULT_ACCESSORY|DEFAULT_MOUNTING/);
  const ensureBody = accessories.match(/export async function ensureCraftAccessoriesReady\(\)[\s\S]*?\n}\n\nexport async function getCraftAccessorySnapshot/)?.[0] ?? "";
  assert.doesNotMatch(ensureBody, /INSERT INTO/);
});

test("physical accessory validation requires measured mass and multiple real dimensions", () => {
  assert.match(accessories, /measuredDimensions/);
  assert.match(accessories, /massG === null \|\| measuredDimensions < 2/);
  assert.match(accessories, /co najmniej dwóch rzeczywistych wymiarów liniowych/);
  assert.match(accessories, /CRAFT_ACCESSORY_KINDS/);
});

test("mounting evidence is separate from accessory evidence and bound to a supported bag family", () => {
  assert.match(accessories, /accessoryId: string/);
  assert.match(accessories, /bagFamily: BuilderFamily/);
  assert.match(accessories, /zone: string/);
  assert.match(accessories, /mountingMethod: string/);
  assert.match(accessories, /anchorCount: number/);
  assert.match(accessories, /minEdgeClearanceMm: number/);
  assert.match(accessories, /requiresReinforcement: boolean/);
  assert.match(accessories, /enumValue\(raw\.bagFamily, BUILDER_FAMILIES/);
});

test("a mounting cannot be validated before its physical accessory", () => {
  assert.match(accessories, /accessory\.status !== "VALIDATED"/);
  assert.match(accessories, /Mocowanie można zatwierdzić dopiero dla zatwierdzonego fizycznie akcesorium/);
});

test("load-bearing handles and straps require measured load evidence before mounting validation", () => {
  assert.match(accessories, /accessory\.kind === "HANDLE" \|\| accessory\.kind === "STRAP"/);
  assert.match(accessories, /validatedLoadN === null/);
  assert.match(accessories, /wymaga zmierzonej nośności przed zatwierdzeniem/);
});

test("explicit zero edge clearance is distinct from a missing measurement", () => {
  assert.match(accessories, /value === null \|\| value === undefined \|\| value === ""/);
  assert.match(accessories, /Brak pomiaru: \$\{field\}/);
  assert.match(accessories, /number < 0/);
});

test("accessory API is owner-only and supports only explicit accessory or mounting records", () => {
  assert.match(route, /isAdminRequest\(request\)/);
  assert.match(route, /raw\.kind === "accessory"/);
  assert.match(route, /raw\.kind === "mounting"/);
  assert.match(route, /createCraftAccessory/);
  assert.match(route, /createCraftMountingProfile/);
  assert.match(route, /Nieobsługiwany typ danych akcesorium/);
});

test("owner panel exposes physical accessory and mounting measurement forms", () => {
  assert.match(panel, /CraftAccessoryManager/);
  assert.match(manager, /Laboratorium akcesoriów/);
  assert.match(manager, /system nie wstawia domyślnych wymiarów, masy ani nośności/i);
  assert.match(manager, /Agata zatwierdziła pomiary tego fizycznego SKU/);
  assert.match(manager, /Agata zatwierdziła ten profil mocowania/);
  assert.match(manager, /Nośność z testu \[N\]/);
});
