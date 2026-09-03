import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const stack = fs.readFileSync("app/exact-live-customizer.tsx", "utf8");
const guard = fs.readFileSync("app/bag-builder-reference-header-guard.tsx", "utf8");

test("Reference Layout V3 mounts a dedicated header persistence guard", () => {
  assert.match(stack, /BagBuilderReferenceHeaderGuard/);
  assert.match(stack, /<BagBuilderReferenceLayoutV3 \/>[\s\S]*?<BagBuilderReferenceHeaderGuard \/>/);
});

test("header guard restores approved copy after React rerenders", () => {
  assert.match(guard, /A-BAGS VISUAL CUSTOMIZER/);
  assert.match(guard, /Zbuduj swoją torebkę od podstaw/);
  assert.match(guard, /Podgląd na żywo  •  Buduj warstwa po warstwie/);
  assert.match(guard, /characterData: true/);
});

test("guarded writes avoid a MutationObserver text loop", () => {
  assert.match(guard, /eyebrow\.textContent !== EYEBROW/);
  assert.match(guard, /title\.textContent !== TITLE/);
  assert.match(guard, /subtitle\.textContent !== SUBTITLE/);
});

test("visual QA can observe an explicit stable-header marker", () => {
  assert.match(guard, /dialog\.dataset\.abagsV3HeaderLocked = "true"/);
});
