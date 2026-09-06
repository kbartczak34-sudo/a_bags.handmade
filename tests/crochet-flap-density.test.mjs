import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [stack, density, css] = await Promise.all([
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-crochet-flap-density.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-crochet-flap-density.css", import.meta.url), "utf8"),
]);

test("crochet flap density sits below surface realism and stitch relief", () => {
  assert.match(stack, /<BagBuilderRigidMaterialFinish\s*\/>[\s\S]*<BagBuilderCrochetFlapDensity\s*\/>[\s\S]*<BagBuilderFlapRealism\s*\/>[\s\S]*<BagBuilderCrochetFlapRelief\s*\/>/);
  assert.match(stack, /import "\.\/bag-builder-crochet-flap-density\.css"/);
  assert.match(density, /DENSITY_VERSION = "crochet-flap-density-v1-solid-cord"/);
  assert.match(css, /z-index:273!important/);
});

test("density backing uses the exact calibrated Fidelity V4 flap contour without reshaping it", () => {
  assert.match(density, /const centerY = spec\.flapY \?\? 0\.29/);
  assert.match(density, /const rx = 0\.80 \* spec\.flapScale\[0\]/);
  assert.match(density, /const ry = 0\.36 \* spec\.flapScale\[1\]/);
  assert.match(density, /const z = spec\.depth \/ 2 \+ 0\.145/);
  assert.match(density, /selected polyester cord and never changes the calibrated flap geometry or stitch layout/);
  assert.doesNotMatch(density, /style\.transform|scale\(|translate3d\(|rotate3d\(/);
});

test("density is limited to crochet, preserves selected cord color and keeps the snap clear", () => {
  assert.match(density, /stage\.dataset\.flap !== "crochet"/);
  assert.match(density, /stage\.dataset\.color \|\| "#eadfd7"/);
  assert.match(density, /context\.fillStyle = rgba\(selectedColor, \[255, 255, 255\], 0\.025, 0\.78\)/);
  assert.match(density, /snapHole\.arc/);
  assert.match(density, /context\.clip\(mask, snap \? "evenodd" : "nonzero"\)/);
});

test("density pass is deterministic, Photo-True safe, event-driven and mobile-safe", () => {
  assert.match(density, /stage\.dataset\.abagsFinal3d !== "ready"/);
  assert.match(density, /stage\.dataset\.abagsPhotoTrue === "active"/);
  assert.match(density, /requestAnimationFrame/);
  assert.match(density, /ResizeObserver/);
  assert.match(density, /abags:fidelity3d-transform/);
  assert.match(density, /dprCap = window\.innerWidth <= 620 \? 1\.5 : 2/);
  assert.doesNotMatch(density, /Math\.random|setInterval|getImageData|putImageData|readPixels/);
  assert.match(css, /pointer-events:none!important/);
  assert.match(css, /touch-action:none!important/);
  assert.match(css, /@media \(max-width:620px\)/);
});
