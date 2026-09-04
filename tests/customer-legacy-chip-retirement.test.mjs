import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const live = readFileSync("app/exact-live-customizer.tsx", "utf8");
const guard = readFileSync("app/bag-builder-customer-legacy-chip-retirement.tsx", "utf8");
const realtimeQa = readFileSync("scripts/smoke-customizer-realtime.mjs", "utf8");

const legacyChips = [
  ".abags-canvas3d-chip",
  ".abags-webgl3d-chip",
  ".abags-real3d-chip",
  ".abags-pro3d-chip",
];

test("customer runtime retires the complete legacy 3D badge family from DOM", () => {
  for (const selector of legacyChips) assert.ok(guard.includes(selector), `${selector} must be retired`);
  assert.match(guard, /querySelectorAll<HTMLElement>\(LEGACY_3D_CHIP_SELECTOR\)/);
  assert.match(guard, /chip\.remove\(\)/);
  assert.doesNotMatch(guard, /style\.setProperty|display\s*:/);
});

test("legacy chip retirement runs after the current reference chrome", () => {
  const reference = live.indexOf("<BagBuilderReferenceV4 />");
  const retirement = live.indexOf("<BagBuilderCustomerLegacyChipRetirement />");
  assert.ok(reference >= 0 && retirement > reference);
  assert.match(live, /import BagBuilderCustomerLegacyChipRetirement/);
});

test("retirement follows portal remounts without touching the Fidelity3D surface", () => {
  assert.match(guard, /MutationObserver\(requestRetirement\)/);
  assert.match(guard, /childList: true, subtree: true/);
  assert.match(guard, /\.abags-bag-builder-stage/);
  assert.doesNotMatch(guard, /canvas\.remove|abags-fidelity3d-canvas.*remove/);
});

test("production acceptance still enforces zero visible legacy 3D badges", () => {
  assert.match(realtimeQa, /visibleLegacy3dChips/);
  assert.match(realtimeQa, /state\.visibleLegacy3dChips\?\.length !== 0/);
  assert.match(realtimeQa, /visible legacy 3D preview chips: 0/);
});
