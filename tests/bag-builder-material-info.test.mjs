import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const materialInfo = fs.readFileSync("app/bag-builder-material-info.tsx", "utf8");
const exact = fs.readFileSync("app/exact-live-customizer.tsx", "utf8");
const entry = fs.readFileSync("app/personalization-entry.tsx", "utf8");

test("Bag Builder shows the real base cord material", () => {
  assert.match(materialInfo, /Sznurek poliestrowy/);
  assert.match(materialInfo, /Pimiotki/);
  assert.match(materialInfo, /Materiał bazowy/);
  assert.match(materialInfo, /data-builder-material/);
});

test("material information is mounted with the active Bag Builder experience", () => {
  assert.match(exact, /BagBuilderMaterialInfo/);
  assert.match(exact, /<BagBuilderMaterialInfo \/>/);
});

test("workshop handoff includes the fixed material without changing configuration pricing", () => {
  assert.match(materialInfo, /Materiał: \$\{MATERIAL_LABEL\} \(\$\{MATERIAL_SOURCE\}\)\./);
  assert.match(materialInfo, /searchParams\.set\("text"/);
  assert.match(entry, /Personalizacja jest wyceniana indywidualnie/);
  assert.doesNotMatch(materialInfo, /price|dopłat|doplat|surcharge/i);
});

test("legacy personalization entry carries the same material truth", () => {
  assert.match(entry, /Sznurek poliestrowy/);
  assert.match(entry, /Pimiotki/);
  assert.match(entry, /A-Bags Visual Customizer 2\.2/);
});
