import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [stack, relief] = await Promise.all([
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-crochet-flap-relief.tsx", import.meta.url), "utf8"),
]);

test("crochet flap relief is mounted after the calibrated flap surface pass", () => {
  assert.match(stack, /<BagBuilderFlapRealism\s*\/>[\s\S]*<BagBuilderCrochetFlapRelief\s*\/>/);
  assert.match(relief, /RELIEF_VERSION = "crochet-flap-stitch-v1"/);
  assert.match(relief, /ABAGS_FIDELITY_V4_FAMILY_SPECS\[family\]/);
});

test("crochet flap relief uses the exact calibrated flap contour and snap anchor", () => {
  assert.match(relief, /const centerY = spec\.flapY \?\? 0\.29/);
  assert.match(relief, /const rx = 0\.80 \* spec\.flapScale\[0\]/);
  assert.match(relief, /const ry = 0\.36 \* spec\.flapScale\[1\]/);
  assert.match(relief, /spec\.depth \/ 2 \+ 0\.145/);
  assert.match(relief, /spec\.depth \/ 2 \+ 0\.176/);
  assert.match(relief, /context\.clip\(mask, snap \? "evenodd" : "nonzero"\)/);
});

test("all four customer stitch choices have distinct neutral relief constructions", () => {
  assert.match(relief, /function drawClassic/);
  assert.match(relief, /function drawHerringbone/);
  assert.match(relief, /function drawBasket/);
  assert.match(relief, /function drawShell/);
  assert.match(relief, /stage\.dataset\.stitch \|\| "classic"/);
  assert.match(relief, /quadraticCurveTo/);
  assert.match(relief, /context\.lineCap = "round"/);
  assert.doesNotMatch(relief, /stage\.dataset\.color|fillStyle\s*=\s*["']#/);
});

test("relief never paints over real Photo-True media or non-crochet flap materials", () => {
  assert.match(relief, /stage\.dataset\.flap !== "crochet"/);
  assert.match(relief, /stage\.dataset\.abagsPhotoTrue === "active"/);
  assert.match(relief, /stage\.dataset\.abagsFinal3d !== "ready"/);
});

test("relief is deterministic, event-driven and mobile gesture safe", () => {
  assert.match(relief, /requestAnimationFrame/);
  assert.match(relief, /ResizeObserver/);
  assert.match(relief, /abags:fidelity3d-transform/);
  assert.match(relief, /dprCap = window\.innerWidth <= 620 \? 1\.5 : 2/);
  assert.match(relief, /pointer-events:none!important/);
  assert.match(relief, /touch-action:none!important/);
  assert.match(relief, /@media \(max-width:620px\)/);
  assert.doesNotMatch(relief, /Math\.random|setInterval|getImageData|putImageData|readPixels/);
});
