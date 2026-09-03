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
  assert.match(v4, /handles: 5/);
  assert.match(v4, /strap: 6/);
  assert.match(v4, /hardware: 6/);
  assert.match(v4, /accent: 7/);
  assert.match(v4, /SUBGROUP_LABELS/);
  assert.match(v4, /Uchwyt/);
  assert.match(v4, /Pasek/);
  assert.match(v4, /Okucia/);
  assert.match(v4, /Ozdoba/);
});

test("V4 has real mobile app chrome wired to controls and the existing share action", () => {
  assert.match(v4, /data-abags-v4-menu/);
  assert.match(v4, /data-abags-v4-share/);
  assert.match(v4, /data-builder-share-project/);
  assert.match(v4, /scrollIntoView/);
});

test("V4 makes the live product materially larger without replacing the renderer", () => {
  assert.match(v4, /abagsV4Zoomed/);
  assert.match(v4, /Przybliż model/);
  assert.match(v4, /108 - current/);
  assert.doesNotMatch(v4, /canvas\.getContext/);
  assert.doesNotMatch(v4, /new Image/);
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
