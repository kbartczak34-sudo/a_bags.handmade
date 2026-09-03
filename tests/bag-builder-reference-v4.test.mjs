import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const stack = fs.readFileSync("app/exact-live-customizer.tsx", "utf8");
const v4 = fs.readFileSync("app/bag-builder-reference-v4.tsx", "utf8");
const css = fs.readFileSync("app/bag-builder-reference-v4.css", "utf8");

test("Reference V4 mounts after the legacy compatibility layout and loads last-mile styles", () => {
  assert.match(stack, /import "\.\/bag-builder-reference-v4\.css"/);
  assert.match(stack, /<BagBuilderReferenceLayoutV3 \/>[\s\S]*?<BagBuilderReferenceHeaderGuard \/>[\s\S]*?<BagBuilderReferenceV4 \/>/);
});

test("V4 starts reopened projects at Fason instead of jumping deep into a saved draft", () => {
  assert.match(v4, /stage\.dataset\.abagsRefStep = "1"/);
  assert.match(v4, /stage\.dataset\.abagsV4Initialized = "true"/);
});

test("V4 keeps eight real builder decisions while presenting seven customer-facing steps", () => {
  assert.match(v4, /family: 1/);
  assert.match(v4, /color: 2/);
  assert.match(v4, /stitch: 3/);
  assert.match(v4, /flap: 4/);
  assert.match(v4, /handles: 5/);
  assert.match(v4, /strap: 5/);
  assert.match(v4, /hardware: 6/);
  assert.match(v4, /accent: 6/);
  assert.match(v4, /SUBGROUP_LABELS/);
  assert.match(v4, /Uchwyt/);
  assert.match(v4, /Pasek/);
  assert.match(v4, /Okucia/);
  assert.match(v4, /Ozdoba/);
});

test("selecting an option keeps its approved accordion open", () => {
  assert.match(v4, /const step = STEP_FOR_KEY\[key\]/);
  assert.match(v4, /stage\.dataset\.abagsRefStep = String\(step\)/);
  assert.match(v4, /classList\.toggle\("is-v3-open", open\)/);
  assert.match(v4, /classList\.toggle\("is-ref-expanded", open\)/);
});

test("V4 has real mobile app chrome wired to controls and the existing share action", () => {
  assert.match(v4, /data-abags-v4-menu/);
  assert.match(v4, /data-abags-v4-share/);
  assert.match(v4, /data-builder-share-project/);
  assert.match(v4, /<svg viewBox="0 0 24 24"/);
  assert.match(v4, /scrollIntoView/);
});

test("V4 makes the live product materially larger without replacing the renderer", () => {
  assert.match(v4, /abagsV4Zoomed/);
  assert.match(v4, /Przybliż model/);
  assert.match(v4, /108 - current/);
  assert.doesNotMatch(v4, /canvas\.getContext/);
  assert.doesNotMatch(v4, /new Image/);
});

test("V4 moves technical cards after the real choices and tags the core summary", () => {
  assert.match(v4, /card\.dataset\.v4CoreSummary = "true"/);
  assert.match(v4, /\[data-builder-material\] \{ order: 72 !important; \}/);
  assert.match(v4, /\[data-builder-validation-status\] \{ order: 73 !important; \}/);
  assert.match(v4, /\[data-builder-project-review\] \{ order: 74 !important; \}/);
  assert.match(v4, /\[data-builder-checkout-handoff\] \{ order: 75 !important; \}/);
});

test("mobile V4 hides technical summary noise until Podsumowanie", () => {
  assert.match(v4, /\[data-builder-material\] \{ display: none !important; \}/);
  assert.match(v4, /not\(\[data-v4-step="7"\]\) \[data-v4-core-summary\]/);
  assert.match(v4, /not\(\[data-v4-step="7"\]\) \[data-builder-validation-status\]/);
  assert.match(v4, /not\(\[data-v4-step="7"\]\) \[data-builder-project-review\]/);
});

test("V4 late runtime styles neutralize legacy zoom and oversized header buttons", () => {
  assert.match(v4, /\.abags-reference-layout-v4 \.abags-pro3d-zoom \{[\s\S]*?opacity: 0 !important/);
  assert.match(v4, /> button\.abags-v4-menu/);
  assert.match(v4, /> button\.abags-v4-share/);
  assert.match(v4, /width: 32px !important/);
  assert.match(v4, /width: 28px !important/);
});

test("mobile actions follow the seven steps instead of covering them", () => {
  assert.match(v4, /\.abags-reference-layout-v4 \.abags-builder-actions \{[\s\S]*?position: relative !important/);
  assert.match(v4, /bottom: auto !important/);
  assert.match(v4, /\[data-builder-copy-spec\]/);
  assert.match(v4, /\[data-builder-share-project\]/);
});

test("mobile V4 is a full-screen app with a short preview and compact inspiration strip", () => {
  assert.match(css, /height:100dvh!important/);
  assert.match(css, /height:330px!important/);
  assert.match(css, /height:92px!important/);
  assert.match(css, /order:1!important/);
  assert.match(css, /order:2!important/);
});

test("mobile accordions match the reference proportions and keep Fason cards three-up", () => {
  assert.match(css, /min-height:50px!important/);
  assert.match(css, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
  assert.match(css, /data-v4-key="family"/);
});

test("desktop V4 preserves the reference three-zone composition", () => {
  assert.match(css, /grid-template-columns:500px minmax\(0,1fr\)!important/);
  assert.match(css, /grid-template-columns:146px minmax\(0,1fr\)!important/);
  assert.match(css, /abags-ref-layers/);
});

test("V4 does not invent a fixed project price", () => {
  assert.doesNotMatch(v4, /399/);
  assert.doesNotMatch(css, /399/);
});
