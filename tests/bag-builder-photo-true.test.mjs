import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const component = fs.readFileSync("app/bag-builder-photo-true.tsx", "utf8");
const exact = fs.readFileSync("app/exact-live-customizer.tsx", "utf8");
const styles = fs.readFileSync("app/bag-builder-photo-true.css", "utf8");
const assetStore = fs.readFileSync("lib/customizer-assets.ts", "utf8");
const exactLibrary = fs.readFileSync("lib/exact-customizer-library.ts", "utf8");

test("Photo-True is mounted after the reference layout and guarded behind QA mode", () => {
  assert.match(exact, /bag-builder-reference-v4-product-stage\.css[\s\S]*?bag-builder-photo-true\.css/);
  assert.match(exact, /<BagBuilderReferenceV4 \/>[\s\S]*?<BagBuilderPhotoTrueGate>[\s\S]*?<BagBuilderPhotoTrue \/>/);
  assert.match(exact, /<BagBuilderPhotoTrueExactOnly \/>/);
});

test("model picker is driven by current real store products and restricted to canonical Exact Live references", () => {
  assert.match(component, /fetch\("\/api\/products"/);
  assert.match(component, /filter\(\(product\) => Boolean\(product\.imageUrl\) && Boolean\(exactReferenceForImage\(product\.imageUrl\)\)\)/);
  assert.match(component, /EXACT_ATELIER_LIBRARY/);
  assert.match(component, /exactReferenceForImage/);
  assert.match(component, /data-photo-product-choice/);
  assert.match(component, /products\.map/);
  assert.doesNotMatch(component, /const FAMILIES/);
});

test("selected product photo is the primary exact preview and synthetic renderers are not used as the base", () => {
  assert.match(component, /abags-photo-true-base/);
  assert.match(component, /src=\{selected\.imageUrl\}/);
  assert.match(component, /const base = selected\?\.imageUrl \|\| \"\"/);
  assert.match(component, /liveStage\.dataset\.abagsPhotoTrue = \"active\"/);
  assert.match(component, /liveStage\.dataset\.photoProductId = selected\.id/);
  assert.match(component, /photoTrueReferenceId/);
  assert.match(component, /photoTrueReferenceSource/);
  assert.match(styles, /data-abags-photo-true="active"[\s\S]*?> svg/);
  assert.match(styles, /\.abags-pro3d-layer/);
  assert.match(styles, /\.abags-canvas3d-layer/);
  assert.match(styles, /display:none!important/);
});

test("exact transparent overlays use all seven photo categories including flap", () => {
  assert.match(component, /\["color", "stitch", "flap", "handles", "strap", "hardware", "accent"\]/);
  assert.match(assetStore, /"color", "stitch", "flap", "handles", "hardware", "strap", "accent"/);
  for (const category of ["color", "stitch", "flap", "handles", "strap", "hardware", "accent"]) {
    assert.match(styles, new RegExp(`data-photo-layer=\\"${category}\\"`));
  }
});

test("photo variants are fetched per selected product and never synthesized when missing", () => {
  assert.match(component, /\/api\/customizer-assets\?productId=/);
  assert.match(component, /matchAsset/);
  assert.match(component, /warstw 1:1/);
  assert.match(component, /kanonicznej biblioteki Exact Live/);
  assert.doesNotMatch(component, /canvas\.getContext|WebGL|filter:\s*hue-rotate|mix-blend-mode/);
});

test("canonical Exact Live library is the source of photographic 1:1 eligibility", () => {
  assert.match(component, /exactReferenceForImage/);
  assert.match(component, /sourceFile\.toLowerCase\(\) === filename/);
  assert.match(exactLibrary, /EXACT_ATELIER_LIBRARY/);
  assert.equal((exactLibrary.match(/\{ id:/g) || []).length, 19);
});

test("legacy family is only an internal compatibility bridge, not the visible model source", () => {
  assert.match(component, /inferLegacyFamily/);
  assert.match(component, /clickLegacyFamily/);
  assert.match(styles, /\[data-photo-true-family-group="true"\][\s\S]*?> \.abags-builder-options[\s\S]*?display:none!important/);
});

test("Photo-True hides legacy presets and misleading synthetic family layer labels", () => {
  assert.match(styles, /\.abags-ref-inspirations[\s\S]*?display:none!important/);
  assert.match(styles, /\.abags-ref-layer-row\[data-ref-edit-key="family"\][\s\S]*?display:none!important/);
  assert.match(styles, /pointer-events:none!important/);
});

test("Photo-True Fason uses natural height instead of a stretched legacy accordion", () => {
  assert.match(styles, /\[data-photo-true-family-group="true"\]\{[\s\S]*?display:block!important/);
  assert.match(styles, /flex:0 0 auto!important/);
  assert.match(styles, /align-content:start!important/);
  assert.match(styles, /min-height:0!important/);
  assert.match(styles, /height:auto!important/);
  assert.match(styles, /max-height:none!important/);
  assert.match(styles, /\.abags-photo-models-mount[\s\S]*?position:static!important/);
  assert.match(styles, /\.abags-photo-models-mount[\s\S]*?align-self:start!important/);
});

test("real model cards match reference density on desktop and mobile", () => {
  assert.match(styles, /\.abags-photo-models-grid\{[\s\S]*?grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(styles, /max-height:238px/);
  assert.match(styles, /\.abags-photo-model-copy small\{display:none!important\}/);
  assert.match(styles, /@media\(max-width:980px\)[\s\S]*?max-height:174px/);
  assert.match(styles, /@media\(max-width:420px\)[\s\S]*?max-height:166px/);
});
