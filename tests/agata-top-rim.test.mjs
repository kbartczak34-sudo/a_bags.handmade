import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [stack, rim] = await Promise.all([
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-agata-top-rim.tsx", import.meta.url), "utf8"),
]);

test("legacy Top Rim layer is isolated from the authoritative V18 renderer", () => {
  assert.doesNotMatch(stack, /<BagBuilderAgataTopRim\s*\/>/);
  assert.match(rim, /ABAGS_FIDELITY_V4_FAMILY_SPECS/);
});

test("legacy rim calibration remains deterministic", () => {
  assert.doesNotMatch(rim, /Math\.random/);
  assert.doesNotMatch(rim, /readPixels|getImageData|putImageData/);
});
