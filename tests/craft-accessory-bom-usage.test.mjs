import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const usage = fs.readFileSync("lib/craft-builder-accessory-bom-usage.ts", "utf8");
const route = fs.readFileSync("app/api/admin/craft-accessory-bom-usage/route.ts", "utf8");
const manager = fs.readFileSync("app/panel/craft-accessory-bom-usage-manager.tsx", "utf8");
const panel = fs.readFileSync("app/panel/admin-panel.tsx", "utf8");

test("accessory BOM usage is a separate explicit evidence table with no defaults", () => {
  assert.match(usage, /CREATE TABLE IF NOT EXISTS craft_builder_accessory_bom_usage/);
  assert.match(usage, /binding_id TEXT PRIMARY KEY NOT NULL/);
  assert.match(usage, /quantity REAL NOT NULL/);
  assert.match(usage, /unit TEXT NOT NULL/);
  assert.doesNotMatch(usage, /DEFAULT_QUANTITY|seedUsage|quantity REAL NOT NULL DEFAULT/);
});

test("BOM usage supports closed physical units and requires positive explicit quantity", () => {
  assert.match(usage, /\["PIECE", "SET", "METER"\]/);
  assert.match(usage, /number <= 0/);
  assert.match(usage, /Ilość BOM musi być dodatnią, jawnie podaną wartością/);
  assert.match(usage, /Nieobsługiwana jednostka BOM/);
});

test("validated BOM usage can only bind to an already validated accessory mapping", () => {
  assert.match(usage, /getCraftBuilderAccessoryBindings/);
  assert.match(usage, /if \(!binding\)/);
  assert.match(usage, /status === "VALIDATED" && binding\.status !== "VALIDATED"/);
  assert.match(usage, /Zużycie BOM można zatwierdzić dopiero dla zatwierdzonego bindingu akcesorium/);
});

test("BOM usage owner API is read and write protected", () => {
  assert.match(route, /isAdminRequest\(request\)/);
  assert.match(route, /export async function GET/);
  assert.match(route, /export async function PUT/);
  assert.doesNotMatch(route, /export async function POST|export async function DELETE/);
});

test("owner panel requires deliberate binding, quantity, unit and approval", () => {
  assert.match(panel, /CraftAccessoryBomUsageManager/);
  assert.match(manager, /Jawne zużycie fizycznych akcesoriów/);
  assert.match(manager, /System nie zakłada automatycznie, że SKU oznacza jedną sztukę/);
  assert.match(manager, /Agata potwierdziła tę ilość i jednostkę jako rzeczywiste zużycie BOM/);
  assert.match(manager, /validatedBindings/);
  assert.match(manager, /binding\.status === "VALIDATED"/);
});
