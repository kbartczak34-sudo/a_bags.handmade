import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const stack = fs.readFileSync("app/exact-live-customizer.tsx", "utf8");
const layout = fs.readFileSync("app/bag-builder-reference-layout-v3.tsx", "utf8");
const reference = fs.readFileSync("app/bag-builder-reference-experience.tsx", "utf8");

test("reference layout v3 is mounted in the real active customizer", () => {
  assert.match(stack, /BagBuilderReferenceLayoutV3/);
  assert.match(stack, /<BagBuilderReferenceLayoutV3 \/>/);
  assert.doesNotMatch(stack, /BagBuilderReferenceLayoutV2/);
  assert.match(layout, /abags-reference-layout-v3/);
  assert.match(layout, /dialog\.dataset\.abagsReferenceLayout = "v3"/);
});

test("desktop builder follows the target three-zone workspace", () => {
  assert.match(layout, /grid-template-columns: minmax\(510px,\.88fr\) minmax\(0,1\.42fr\)/);
  assert.match(layout, /grid-template-columns: 148px minmax\(0,1fr\)/);
  assert.match(layout, /\.abags-ref-step-rail/);
  assert.match(layout, /\.abags-ref-layers/);
  assert.match(layout, /\.abags-ref-inspirations/);
  assert.match(layout, /\.abags-ref-trust/);
});

test("mobile builder is full screen and places live preview before accordion controls", () => {
  assert.match(layout, /@media \(max-width: 900px\)/);
  assert.match(layout, /width: 100vw !important/);
  assert.match(layout, /height: 100dvh !important/);
  assert.match(layout, /\.abags-vc-preview-column \{[\s\S]*?order: 1 !important/);
  assert.match(layout, /\.abags-exact-live-mount \{[\s\S]*?order: 2 !important/);
  assert.match(layout, /\.abags-ref-step-rail \{ display: none !important; \}/);
  assert.match(layout, /height: min\(43dvh,360px\) !important/);
});

test("header copy and seven visual steps match the reference experience", () => {
  assert.match(layout, /A-BAGS VISUAL CUSTOMIZER/);
  assert.match(layout, /Zbuduj swoją torebkę od podstaw/);
  assert.match(layout, /Podgląd na żywo  •  Buduj warstwa po warstwie/);
  assert.match(layout, /handles: "Uchwyt \/ pasek"/);
  assert.match(layout, /strap: "Uchwyt \/ pasek"/);
  assert.match(layout, /hardware: "Dodatki"/);
  assert.match(layout, /accent: "Dodatki"/);
  assert.match(reference, /\{ label: "Podsumowanie", key: "summary" \}/);
});

test("reference family photos, inspiration presets and active layers remain real interactive UI", () => {
  assert.match(reference, /abags-ref-family-photo/);
  assert.match(reference, /makeInspirations/);
  assert.match(reference, /makeLayers/);
  assert.match(reference, /applyPreset/);
  assert.match(reference, /data-ref-edit-key/);
  assert.match(layout, /abags-ref-family-photo/);
  assert.match(layout, /abags-ref-inspiration-track/);
});

test("visual layer keeps only one interactive renderer visible at a time", () => {
  assert.match(stack, /<BagBuilderFidelity3D \/>/);
  assert.match(stack, /<BagBuilderRendererFallback \/>/);
  assert.doesNotMatch(stack, /AtelierBagRendererV7/);
  assert.doesNotMatch(stack, /BagBuilderMaterialPass/);
  assert.doesNotMatch(stack, /BagBuilderConstructionPass/);
  assert.match(layout, /abags-bag-builder-stage\.abags-pro3d-active > svg/);
  assert.match(layout, /abags-bag-builder-stage\.abags-canvas3d-active > svg/);
});

test("target look does not invent a personalization price", () => {
  assert.match(layout, /abags-builder-live-price/);
  assert.doesNotMatch(layout, /399\s*zł/);
  assert.doesNotMatch(layout, /unit_amount/);
});
