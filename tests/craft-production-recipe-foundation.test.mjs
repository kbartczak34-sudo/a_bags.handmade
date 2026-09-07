import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const recipes = fs.readFileSync("lib/craft-production-recipes.ts", "utf8");
const route = fs.readFileSync("app/api/admin/craft-production-recipes/route.ts", "utf8");
const manager = fs.readFileSync("app/panel/craft-production-recipe-manager.tsx", "utf8");
const panel = fs.readFileSync("app/panel/admin-panel.tsx", "utf8");

test("production recipes are versioned per family and stitch with no seeded instructions", () => {
  assert.match(recipes, /CREATE TABLE IF NOT EXISTS craft_production_recipes/);
  assert.match(recipes, /CREATE TABLE IF NOT EXISTS craft_production_steps/);
  assert.match(recipes, /UNIQUE\(bag_family, stitch_pattern_id, version\)/);
  assert.doesNotMatch(recipes, /seedRecipe|seedStep|DEFAULT_RECIPE|DEFAULT_STEP/);
  const ensureBody = recipes.match(/export async function ensureCraftProductionRecipesReady\(\)[\s\S]*?\n}\n\nexport async function getCraftProductionRecipes/)?.[0] ?? "";
  assert.doesNotMatch(ensureBody, /INSERT INTO/);
});

test("server owns production step order and supports explicit craft step types", () => {
  assert.match(recipes, /"CROCHET", "JOIN", "ATTACH", "SEW", "FINISH", "QC"/);
  assert.match(recipes, /stepOrder: index \+ 1/);
  assert.doesNotMatch(recipes, /stepOrder:\s*raw\./);
});

test("ATTACH is always traceable to a concrete builder accessory slot", () => {
  assert.match(recipes, /stepType === "ATTACH" && !appliesToSlot/);
  assert.match(recipes, /Każdy krok ATTACH musi wskazywać konkretny slot akcesorium/);
  assert.match(recipes, /stepType !== "ATTACH" && appliesToSlot/);
});

test("validated recipe requires crochet, finish, QC criterion and hardware attachment", () => {
  assert.match(recipes, /\["CROCHET", "FINISH", "QC"\]/);
  assert.match(recipes, /step\.stepType === "ATTACH" && step\.appliesToSlot === "hardware"/);
  assert.match(recipes, /step\.stepType === "QC" && step\.qcCriterion\.length > 0/);
  assert.match(recipes, /Zatwierdzona receptura wymaga jawnego kroku ATTACH dla okuć/);
});

test("a production recipe is created as a new immutable version instead of patched in place", () => {
  assert.match(route, /export async function POST/);
  assert.doesNotMatch(route, /export async function PUT|export async function PATCH|export async function DELETE/);
  assert.match(recipes, /INSERT INTO craft_production_recipes/);
  assert.doesNotMatch(recipes, /UPDATE craft_production_recipes/);
});

test("production recipe API is owner-only", () => {
  assert.match(route, /isAdminRequest\(request\)/);
  assert.match(route, /getCraftProductionRecipes/);
  assert.match(route, /createCraftProductionRecipe/);
});

test("owner panel provides explicit versioned production and QC editor", () => {
  assert.match(panel, /CraftProductionRecipeManager/);
  assert.match(manager, /Receptura wykonania i kontroli jakości/);
  assert.match(manager, /System nie generuje kroków z podglądu 3D i nie dopisuje instrukcji za Agatę/);
  assert.match(manager, /Agata zatwierdziła tę wersję jako rzeczywistą recepturę produkcyjną i QC/);
  assert.match(manager, /Kryterium QC/);
  assert.match(manager, /Slot akcesorium/);
});
