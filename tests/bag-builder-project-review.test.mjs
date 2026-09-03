import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const review = fs.readFileSync("app/bag-builder-project-review.tsx", "utf8");
const exact = fs.readFileSync("app/exact-live-customizer.tsx", "utf8");

test("project review is mounted with the active Bag Builder", () => {
  assert.match(exact, /BagBuilderProjectReview/);
  assert.match(exact, /<BagBuilderProjectReview \/>/);
});

test("review covers every Bag Builder decision and the real material", () => {
  assert.match(review, /Sznurek poliestrowy · Pimiotki/);
  assert.match(review, /Fason:/);
  assert.match(review, /Kolor sznurka:/);
  assert.match(review, /Splot \/ ścieg:/);
  assert.match(review, /Klapa:/);
  assert.match(review, /Uchwyty:/);
  assert.match(review, /Pasek:/);
  assert.match(review, /Okucia:/);
  assert.match(review, /Detal \/ ozdoba:/);
});

test("project receives a deterministic code from the selected configuration", () => {
  assert.match(review, /function projectCode/);
  assert.match(review, /Object\.values\(config\)\.join\("\\\|"\)/);
  assert.match(review, /AB-/);
  assert.match(review, /Math\.imul\(hash, 16777619\)/);
});

test("complete specification can be copied without enabling incomplete projects", () => {
  assert.match(review, /Kopiuj specyfikację/);
  assert.match(review, /navigator\.clipboard/);
  assert.match(review, /document\.execCommand\("copy"\)/);
  assert.match(review, /button\.disabled = !\(config\.family && config\.color && config\.stitch\)/);
});

test("review keeps pricing individually confirmed by the workshop", () => {
  assert.match(review, /Cena personalizacji: do indywidualnego potwierdzenia przez pracownię/);
  assert.doesNotMatch(review, /optionPrice|previewPrice|surcharge|dopłat|doplat/i);
});
