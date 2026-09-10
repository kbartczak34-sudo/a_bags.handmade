import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [overlay, fidelity, exactLibrary, stack, renderer] = await Promise.all([
  readFile(new URL("../app/bag-builder-accessory-fidelity-overlay.tsx", import.meta.url), "utf8"),
  readFile(new URL("../lib/abags-accessory-fidelity.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/exact-customizer-library.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-final-webgl3d.tsx", import.meta.url), "utf8"),
]);

test("accessory refinement stays mounted without competing with the authoritative V18 renderer", () => {
  assert.match(stack, /<BagBuilderAccessoryFidelityOverlay\s*\/>/);
  assert.doesNotMatch(stack, /<BagBuilderFinalWebGL3D\s*\/>/);
});

test("accessory calibration remains evidence based and deterministic", () => {
  assert.match(fidelity, /ABAGS_ACCESSORY_FIDELITY_VERSION/);
  assert.match(exactLibrary, /navy-wood-scarf-chain/);
  assert.match(overlay, /data-abags-accessory-fidelity/);
  assert.doesNotMatch(overlay, /Math\.random/);
});

test("legacy renderer does not own strap or accent geometry", () => {
  assert.doesNotMatch(renderer, /config\.strap\s*!==\s*"none"/);
  assert.doesNotMatch(renderer, /config\.accent\s*===\s*"charm"/);
});
