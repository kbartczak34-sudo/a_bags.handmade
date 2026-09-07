import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [stack, basket, css] = await Promise.all([
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-basket-physical-cord-v2.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-basket-physical-cord-v2.css", import.meta.url), "utf8"),
]);

test("Basket Physical Cord V2 replaces only the basket V1 pass and stays below edge finishing", () => {
  assert.match(stack, /bag-builder-basket-physical-cord-v2\.css/);
  assert.match(stack, /<BagBuilderPhysicalCordGeometry\s*\/>[\s\S]*<BagBuilderBasketPhysicalCordV2\s*\/>[\s\S]*<BagBuilderHandmadeEdgeFinish\s*\/>/);
  assert.match(basket, /SURFACE_VERSION = "basket-physical-cord-v2-continuous-handmade-weave"/);
  assert.match(css, /z-index:4!important/);
  assert.match(css, /data-stitch="basket"/);
  assert.match(css, /data-abags-basket-physical-cord-v2="basket-physical-cord-v2-continuous-handmade-weave"[\s\S]*abags-physical-cord-geometry/);
});

test("V2 takes exclusive structural basket ownership only after its ready marker", () => {
  const readyMarker = /data-stitch="basket"\]\[data-abags-basket-physical-cord-v2="basket-physical-cord-v2-continuous-handmade-weave"\]/;
  assert.match(css, readyMarker);
  assert.match(css, /abags-basket-weave-surface\s*\{[\s\S]*opacity:0!important;[\s\S]*visibility:visible!important;/);
  assert.match(css, /abags-physical-cord-geometry,[\s\S]*abags-basket-weave-surface/);
  assert.match(css, /structural basket topology[\s\S]*exactly one visible owner/);
  assert.match(css, /opacity:\.94!important/);
  assert.match(css, /@media \(max-width:620px\)[\s\S]*opacity:\.88!important/);
});

test("V2 uses continuous sampled tubes instead of isolated cell-by-cell basket bars", () => {
  assert.match(basket, /function addPolylineTube/);
  assert.match(basket, /const PATH_SAMPLES = 52/);
  assert.match(basket, /const TUBE_SEGMENTS = 10/);
  assert.match(basket, /const horizontalPoints: Point3\[\] = \[\]/);
  assert.match(basket, /const verticalPoints: Point3\[\] = \[\]/);
  assert.match(basket, /addPolylineTube\(data, horizontalPoints/);
  assert.match(basket, /addPolylineTube\(data, verticalPoints/);
  assert.doesNotMatch(basket, /gapX = dx|gapY = dy/);
});

test("basket crossings still have genuine over-under depth but with restrained relief", () => {
  assert.match(basket, /const overLift = radius \* 0\.28/);
  assert.match(basket, /const underSink = radius \* -0\.20/);
  assert.match(basket, /const horizontalOver = \(row \+ column\) % 2 === 0/);
  assert.match(basket, /const verticalOver = !horizontalOver/);
  assert.match(basket, /smoothCrossingWeight/);
  assert.match(basket, /target - neutralLift/);
  assert.match(basket, /Math\.max\(0\.017, Math\.min\(0\.026, Math\.min\(spec\.rx, spec\.ry\) \* 0\.024\)\)/);
});

test("handmade basket paths are deterministic, curved and inset farther than V1", () => {
  assert.match(basket, /const SURFACE_INSET = 0\.070/);
  assert.match(basket, /safeNy = Math\.max\(-0\.82, Math\.min\(0\.82, ny\)\)/);
  assert.match(basket, /safeNx = Math\.max\(-0\.88, Math\.min\(0\.88, nx\)\)/);
  assert.match(basket, /handmadeWave/);
  assert.match(basket, /deterministicDrift/);
  assert.match(basket, /halfWidthAtY/);
  assert.doesNotMatch(basket, /Math\.random/);
  assert.doesNotMatch(basket, /spec\.(rx|ry|depth)\s*=/);
});

test("V2 is true WebGL geometry with 3D normals and softer polyester response", () => {
  assert.match(basket, /normal: Point3/);
  assert.match(basket, /cross\(tangent, side\)/);
  assert.match(basket, /vNormal=normalize\(mat3\(uModel\)\*aNormal\)/);
  assert.match(basket, /float crown=pow/);
  assert.match(basket, /float filament=/);
  assert.match(basket, /gl\.enable\(gl\.DEPTH_TEST\)/);
  assert.match(basket, /gl\.drawArrays\(gl\.TRIANGLES/);
  assert.doesNotMatch(basket, /lineWidth/);
});

test("Basket Physical Cord V2 is fail-safe, Photo-True isolated, event-driven and mobile-safe", () => {
  assert.match(basket, /stage\.dataset\.stitch !== "basket"/);
  assert.match(basket, /stage\.dataset\.abagsPhotoTrue === "active"/);
  assert.match(basket, /stage\.dataset\.abagsAgataCordWebgl !== "agata-cord-webgl-v1-photo-calibrated"/);
  assert.match(basket, /window\.innerWidth <= 620 \? 1\.25 : 1\.65/);
  assert.match(basket, /requestAnimationFrame/);
  assert.match(basket, /ResizeObserver/);
  assert.match(basket, /abags:fidelity3d-transform/);
  assert.match(css, /pointer-events:none!important/);
  assert.match(css, /touch-action:none!important/);
  assert.match(css, /data-abags-photo-true="active"/);
  assert.doesNotMatch(basket, /setInterval|readPixels|getImageData|putImageData/);
});
