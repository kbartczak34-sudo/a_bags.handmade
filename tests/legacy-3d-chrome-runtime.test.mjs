import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const live = readFileSync("app/exact-live-customizer.tsx", "utf8");
const retirement = readFileSync("app/bag-builder-legacy-chrome-retirement.tsx", "utf8");
const realtimeQa = readFileSync("scripts/smoke-customizer-realtime.mjs", "utf8");

const legacyChips = [
  ".abags-canvas3d-chip",
  ".abags-webgl3d-chip",
  ".abags-real3d-chip",
  ".abags-pro3d-chip",
];

test("legacy 3D chrome retirement runs after reference UI mutation layers", () => {
  const reference = live.indexOf("<BagBuilderReferenceExperience />");
  const referenceV4 = live.indexOf("<BagBuilderReferenceV4 />");
  const retirementMount = live.indexOf("<BagBuilderLegacyChromeRetirement />");
  assert.ok(reference >= 0 && referenceV4 > reference && retirementMount > referenceV4);
});

test("customer runtime retires every legacy 3D badge without depending on stylesheet order", () => {
  for (const selector of legacyChips) assert.ok(retirement.includes(selector), `${selector} must be retired at runtime`);
  assert.match(retirement, /chip\.hidden = true/);
  assert.match(retirement, /setAttribute\("aria-hidden", "true"\)/);
  assert.match(retirement, /setAttribute\("data-abags-legacy-chrome", "retired"\)/);
  assert.match(retirement, /setProperty\("display", "none", "important"\)/);
  assert.match(retirement, /setProperty\("visibility", "hidden", "important"\)/);
  assert.match(retirement, /setProperty\("pointer-events", "none", "important"\)/);
});

test("legacy chrome retirement is reversible and isolated from Photo-True", () => {
  assert.match(retirement, /stage\.dataset\.abagsPhotoTrue === "active"/);
  assert.match(retirement, /restoreAll\(\)/);
  assert.match(retirement, /restoreChip\(chip, state\)/);
  assert.match(retirement, /observer\.disconnect\(\)/);
  assert.match(retirement, /window\.cancelAnimationFrame\(frame\)/);
});

test("production browser acceptance still hard-fails if a retired badge is visibly rendered", () => {
  assert.match(realtimeQa, /visibleLegacy3dChips/);
  assert.match(realtimeQa, /state\.visibleLegacy3dChips\?\.length !== 0/);
  assert.match(realtimeQa, /visible legacy 3D preview chips: 0/);
});
