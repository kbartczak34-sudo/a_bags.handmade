import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [stack, rim, css] = await Promise.all([
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-agata-top-rim.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-agata-top-rim.css", import.meta.url), "utf8"),
]);

test("legacy Top Rim layer is isolated while V18 owns the customer product opening", () => {
  assert.doesNotMatch(stack, /<BagBuilderAgataTopRim\s*\/>/);
  assert.match(stack, /<BagBuilderOpeningDepth\s*\/>/);
  assert.match(css, /data-abags-agata-cord-webgl/);
});

test("legacy rim calibration remains deterministic and geometry-safe", () => {
  assert.match(rim, /ABAGS_FIDELITY_V4_FAMILY_SPECS/);
  assert.doesNotMatch(rim, /Math\.random/);
  assert.doesNotMatch(rim, /readPixels|getImageData|putImageData/);
});
