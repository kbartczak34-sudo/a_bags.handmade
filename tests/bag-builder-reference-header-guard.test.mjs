import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const stack = fs.readFileSync("app/exact-live-customizer.tsx", "utf8");
const guard = fs.readFileSync("app/bag-builder-reference-header-guard.tsx", "utf8");
const engine = fs.readFileSync("app/bag-builder-engine.tsx", "utf8");
const fixes = fs.readFileSync("app/bag-builder-reference-ui-fixes.css", "utf8");

test("Reference Layout V3 mounts a dedicated header persistence guard", () => {
  assert.match(stack, /BagBuilderReferenceHeaderGuard/);
  assert.match(stack, /<BagBuilderReferenceLayoutV3 \/>[\s\S]*?<BagBuilderReferenceHeaderGuard \/>/);
});

test("header guard owns approved copy instead of racing the legacy engine selectors", () => {
  assert.match(guard, /A-BAGS VISUAL CUSTOMIZER/);
  assert.match(guard, /Zbuduj swoją torebkę od podstaw/);
  assert.match(guard, /Podgląd na żywo  •  Buduj warstwa po warstwie/);
  assert.match(engine, /\.abags-vc-header \.eyebrow/);
  assert.match(engine, /\.abags-vc-header h2/);
  assert.match(guard, /classList\.remove\("eyebrow"\)/);
  assert.match(guard, /classList\.add\("abags-v3-eyebrow"\)/);
  assert.match(guard, /document\.createElement\("div"\)/);
  assert.match(guard, /replacement\.setAttribute\("role", "heading"\)/);
  assert.match(guard, /replacement\.setAttribute\("aria-level", "2"\)/);
  assert.match(guard, /legacy\.replaceWith\(replacement\)/);
});

test("V3 heading preserves accessible identity and typography after selector takeover", () => {
  assert.match(guard, /replacement\.id = legacy\.id \|\| "abags-vc-title"/);
  assert.match(guard, /current\.id = "abags-vc-title"/);
  assert.match(fixes, /\.abags-vc-header \.abags-v3-eyebrow/);
  assert.match(fixes, /\.abags-vc-header \.abags-v3-title/);
});

test("mobile V3 uses the intended compact app bar instead of overflowing title copy", () => {
  assert.match(fixes, /@media\(max-width:980px\)/);
  assert.match(fixes, /\.abags-reference-layout-v3 \.abags-vc-header \.abags-v3-eyebrow/);
  assert.match(fixes, /font-size:8px!important/);
  assert.match(fixes, /\.abags-reference-layout-v3 \.abags-vc-header \.abags-v3-title,[\s\S]*?display:none!important/);
});

test("V3 accordion labels cannot inherit the legacy rotated chevron transform", () => {
  assert.match(fixes, /\.abags-reference-layout-v3 \.abags-builder-group legend::after/);
  assert.match(fixes, /transform:none!important/);
});

test("V3 legend badges follow seven customer steps instead of raw fieldset numbers", () => {
  assert.match(fixes, /data-v3-key=\"family\"[^\n]*content:\"01\"!important/);
  assert.match(fixes, /data-v3-key=\"handles\"[\s\S]*?data-v3-key=\"strap\"[\s\S]*?content:\"05\"!important/);
  assert.match(fixes, /data-v3-key=\"hardware\"[\s\S]*?data-v3-key=\"accent\"[\s\S]*?content:\"06\"!important/);
  assert.doesNotMatch(fixes, /data-v3-key=\"accent\"[^\n]*content:\"07\"/);
});

test("V3 logical badge hides the legacy fieldset number with stronger specificity", () => {
  assert.match(fixes, /\.abags-reference-layout-v3 \.abags-builder-group\[data-v3-key\] legend > span\{[\s\S]*?font-size:0!important[\s\S]*?color:transparent!important/);
  assert.match(fixes, /\.abags-reference-layout-v3 \.abags-builder-group\[data-v3-key\] legend > span::after\{[\s\S]*?color:#9a636d!important[\s\S]*?font-size:9px!important/);
});

test("desktop step rail keeps full labels without a horizontal scrollbar", () => {
  assert.match(fixes, /@media\(min-width:901px\)/);
  assert.match(fixes, /grid-template-columns:160px minmax\(0,1fr\)!important/);
  assert.match(fixes, /\.abags-reference-layout-v3 \.abags-ref-step-rail\{[\s\S]*?overflow-x:hidden!important/);
  assert.match(fixes, /white-space:normal!important/);
});

test("mobile color choices stay swipeable without the native gray scrollbar", () => {
  assert.match(fixes, /data-v3-key=\"color\"[^\n]*\.abags-builder-options\{[\s\S]*?scrollbar-width:none!important/);
  assert.match(fixes, /data-v3-key=\"color\"[^\n]*\.abags-builder-options::\-webkit-scrollbar\{[\s\S]*?display:none!important/);
});

test("modal stays above the consent banner without changing the privacy choice", () => {
  assert.match(fixes, /body\.abags-vc-open \.abags-vc-layer-root/);
  assert.match(fixes, /z-index:2147483200!important/);
  assert.doesNotMatch(guard, /privacy-banner/);
  assert.doesNotMatch(guard, /abags-external-content/);
});

test("guarded writes avoid a MutationObserver text loop", () => {
  assert.match(guard, /current\.textContent !== EYEBROW/);
  assert.match(guard, /current\.textContent !== TITLE/);
  assert.match(guard, /subtitle\.textContent !== SUBTITLE/);
  assert.match(guard, /characterData: true/);
});

test("visual QA can observe an explicit stable-header marker", () => {
  assert.match(guard, /dialog\.dataset\.abagsV3HeaderLocked = "true"/);
});
