import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [overlay, fidelity, stack] = await Promise.all([
  readFile(new URL("../app/bag-builder-accessory-fidelity-overlay.tsx", import.meta.url), "utf8"),
  readFile(new URL("../lib/abags-accessory-fidelity.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
]);

test("accessory refinement remains mounted without competing with V18", () => {
  assert.match(stack, /<BagBuilderAccessoryFidelityOverlay\s*\/>/);
  assert.doesNotMatch(stack, /<BagBuilderFinalWebGL3D\s*\/>/);
});

test("accessory calibration remains deterministic", () => {
  assert.match(fidelity, /ABAGS_ACCESSORY_FIDELITY_VERSION/);
  assert.match(overlay, /data-abags-accessory-fidelity/);
  assert.doesNotMatch(overlay, /Math\.random/);
});
