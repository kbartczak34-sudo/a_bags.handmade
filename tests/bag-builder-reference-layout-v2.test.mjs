import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const stack = fs.readFileSync("app/exact-live-customizer.tsx", "utf8");
const layout = fs.readFileSync("app/bag-builder-reference-layout-v2.tsx", "utf8");
const reference = fs.readFileSync("app/bag-builder-reference-experience.tsx", "utf8");

test("active customizer uses one primary high-fidelity visual renderer", () => {
  assert.match(stack, /<BagBuilderFidelity3D \/>/);
  assert.match(stack, /<BagBuilderPro3DTouchRescue \/>/);
  assert.doesNotMatch(stack, /AtelierBagRendererV7/);
  assert.doesNotMatch(stack, /BagBuilderCanvas3D/);
  assert.doesNotMatch(stack, /BagBuilderMaterialPass/);
  assert.doesNotMatch(stack, /BagBuilderConstructionPass/);
});

test("reference layout v2 is mounted in the real active customizer", () => {
  assert.match(stack, /BagBuilderReferenceLayoutV2/);
  assert.match(stack, /<BagBuilderReferenceLayoutV2 \/>/);
  assert.match(layout, /abags-target-layout-v2/);
});

test("desktop layout follows the reference split workspace", () => {
  assert.match(layout, /grid-template-columns: minmax\(500px, \.9fr\) minmax\(0, 1\.45fr\)/);
  assert.match(layout, /grid-template-columns: 154px minmax\(0, 1fr\)/);
  assert.match(layout, /abags-ref-step-rail/);
  assert.match(layout, /abags-ref-layers/);
  assert.match(layout, /abags-ref-inspirations/);
});

test("mobile layout puts clean live preview before accordion controls", () => {
  assert.match(layout, /@media \(max-width: 820px\)/);
  assert.match(layout, /\.abags-vc-preview-column \{[\s\S]*?order: 1 !important/);
  assert.match(layout, /\.abags-exact-live-mount \{[\s\S]*?order: 2 !important/);
  assert.match(layout, /\.abags-ref-step-rail \{[\s\S]*?display: none !important/);
  assert.match(layout, /\.abags-builder-group:not\(\.is-target-open\) \.abags-builder-options/);
});

test("seven visual steps group handle with strap and hardware with accents", () => {
  assert.match(layout, /handles: "Uchwyt \/ pasek"/);
  assert.match(layout, /strap: "Uchwyt \/ pasek"/);
  assert.match(layout, /hardware: "Dodatki"/);
  assert.match(layout, /accent: "Dodatki"/);
  assert.match(layout, /if \(key === "handles" \|\| key === "strap"\) return 5/);
  assert.match(layout, /if \(key === "hardware" \|\| key === "accent"\) return 6/);
  assert.match(reference, /\{ label: "Podsumowanie", key: "summary" \}/);
});

test("legacy preview and duplicate visual layers are explicitly hidden", () => {
  assert.match(layout, /\.abags-bag-builder-stage > svg/);
  assert.match(layout, /\.abags-atelier-v7-layer/);
  assert.match(layout, /\.abags-canvas3d-layer/);
  assert.match(layout, /\.abags-material-pass/);
  assert.match(layout, /\.abags-pro3d-layer\.abags-fidelity3d-layer/);
});
