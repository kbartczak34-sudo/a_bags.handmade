import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const manager = fs.readFileSync("app/panel/customizer-assets-manager.tsx", "utf8");
const styles = fs.readFileSync("app/panel/customizer-assets-coverage.css", "utf8");

test("owner panel reports photographic coverage per real product without calling it manufacturability", () => {
  assert.match(manager, /Pokrycie biblioteki 1:1/);
  assert.match(manager, /Brak warstwy <strong>nie oznacza<\/strong>, że wariantu nie można wykonać/);
  assert.match(manager, /oznacza tylko, że kreator nie pokaże go fotograficznie 1:1/);
  assert.doesNotMatch(manager, /brak warstwy[^\n]{0,120}niedostępn/i);
});

test("base-photo choices are excluded from the overlay target count", () => {
  for (const value of ["flap:bez-klapy", "handles:bez-uchwytu", "strap:bez-paska", "accent:bez-ozdoby"]) {
    assert.match(manager, new RegExp(value));
  }
  assert.match(manager, /!BASE_PREVIEW_VARIANTS\.has\(`\$\{key\}:\$\{preset\.value\}`\)/);
  assert.match(manager, /nie zwiększają licznika wymaganych nakładek/);
});

test("coverage understands the same legacy aliases used by Photo-True", () => {
  assert.match(manager, /"color:natural-bez": \["natural-bez", "naturalny-bez", "bez", "kremowy"\]/);
  assert.match(manager, /"handles:drewniane-jasne": \["drewniane-jasne", "drewno-jasne", "drewniane", "wood-light"\]/);
  assert.match(manager, /"accent:apaszka": \["apaszka", "kokarda", "scarf"\]/);
  assert.match(manager, /hasPreviewAsset/);
});

test("preset labels are canonicalized before upload so datalist wording cannot create unusable keys", () => {
  assert.match(manager, /function canonicalVariant/);
  assert.match(manager, /new Set\(\[\.\.\.acceptedKeys\(category, item\), slug\(item\.label\)\]\)/);
  assert.match(manager, /return preset\?\.value \?\? normalized/);
  assert.match(manager, /const normalizedVariant = canonicalVariant\(category, variant\)/);
  assert.match(manager, /Zapisze się jako: \{canonicalVariant\(category, variant\)/);
});

test("missing preview chips jump directly into the upload workflow", () => {
  assert.match(manager, /const focusMissing/);
  assert.match(manager, /setCategory\(nextCategory\)/);
  assert.match(manager, /setVariant\(preset\.label\)/);
  assert.match(manager, /scrollIntoView\(\{ behavior: "smooth", block: "center" \}\)/);
  assert.match(manager, /onClick=\{\(\) => focusMissing\(item\.key, preset\)\}/);
});

test("non-standard stored layers remain visible but do not fake standard coverage", () => {
  assert.match(manager, /const customAssets = assets\.filter\(\(asset\) => !isKnownPreviewAsset\(asset\)\)/);
  assert.match(manager, /niestandardowy klucz wariantu/);
  assert.match(manager, /nie są liczone jako pokrycie standardowych opcji kreatora/);
});

test("coverage dashboard stays responsive in the owner panel", () => {
  assert.match(manager, /import "\.\/customizer-assets-coverage\.css"/);
  assert.match(styles, /\.photo-coverage-grid\{[\s\S]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /@media\(max-width:760px\)/);
  assert.match(styles, /\.photo-coverage-grid\{\s*grid-template-columns:1fr/);
});
