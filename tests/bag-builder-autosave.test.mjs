import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const autosave = fs.readFileSync("app/bag-builder-autosave.tsx", "utf8");
const exact = fs.readFileSync("app/exact-live-customizer.tsx", "utf8");

test("autosave is mounted after validation in the active Bag Builder", () => {
  assert.match(exact, /BagBuilderAutosave/);
  assert.match(exact, /<BagBuilderValidationGuard \/>[\s\S]*<BagBuilderAutosave \/>/);
});

test("autosave accepts only currently supported builder values", () => {
  assert.match(autosave, /const ALLOWED/);
  assert.match(autosave, /KEYS\.every\(\(key\) => ALLOWED\[key\]\.has\(config\[key\]\)\)/);
});

test("valid partial projects are debounced into localStorage", () => {
  assert.match(autosave, /AUTOSAVE_DELAY = 240/);
  assert.match(autosave, /localStorage\.setItem\(DRAFT_KEY, JSON\.stringify\(config\)\)/);
  assert.match(autosave, /window\.setTimeout/);
  assert.match(autosave, /Wersja robocza zapisana automatycznie ✓/);
});

test("reset projects remain empty instead of being re-saved as a blank draft", () => {
  assert.match(autosave, /function isEmpty/);
  assert.match(autosave, /isEmpty\(config\) \? safeRemove\(\) : safeSave\(config\)/);
  assert.match(autosave, /localStorage\.removeItem\(DRAFT_KEY\)/);
});

test("autosave does not persist intermediate states during shared-link import", () => {
  assert.match(autosave, /controls\.dataset\.builderSharedImport === "loading"/);
});

test("autosave communicates storage availability without blocking the builder", () => {
  assert.match(autosave, /Automatyczny zapis jest niedostępny w tej przeglądarce/);
  assert.match(autosave, /Wersja robocza zapisuje się automatycznie na tym urządzeniu/);
});
