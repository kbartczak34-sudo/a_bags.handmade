import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [stack, geometry, css] = await Promise.all([
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-physical-cord-geometry.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-physical-cord-geometry.css", import.meta.url), "utf8"),
]);

test("Physical Cord V1 is mounted above the flat basket material and below edge/accessory finishing", () => {
  assert.match(stack, /bag-builder-physical-cord-geometry\.css/);
  assert.match(stack, /<BagBuilderBasketWeaveFinish\s*\/>[\s\S]*<BagBuilderPhysicalCordGeometry\s*\/>[\s\S]*<BagBuilderHandmadeEdgeFinish\s*\/>/);
  assert.match(geometry, /SURFACE_VERSION = "physical-cord-geometry-v1-volumetric-loops"/);
  assert.match(css, /z-index:6!important/);
});

test("cords are actual cylindrical WebGL geometry with 3D normals rather than painted relief", () => {
  assert.match(geometry, /function addTube/);
  assert.match(geometry, /const TUBE_SEGMENTS = 8/);
  assert.match(geometry, /normal: Point3/);
  assert.match(geometry, /position: Point3/);
  assert.match(geometry, /gl\.enable\(gl\.DEPTH_TEST\)/);
  assert.match(geometry, /gl\.drawArrays\(gl\.TRIANGLES/);
  assert.match(geometry, /vNormal=normalize\(mat3\(uModel\)\*aNormal\)/);
  assert.doesNotMatch(geometry, /lineWidth/);
});

test("all four A-Bags stitch families have independent physical cord constructions", () => {
  assert.match(geometry, /function buildOpenV/);
  assert.match(geometry, /function buildVerticalOpen/);
  assert.match(geometry, /function buildBasket/);
  assert.match(geometry, /function buildRadial/);
  assert.match(geometry, /stitch === "herringbone"/);
  assert.match(geometry, /stitch === "basket"/);
  assert.match(geometry, /stitch === "shell"/);
});

test("basket physically separates over and under cords in Z and breaks the hidden under-cord", () => {
  const basket = geometry.match(/function buildBasket\([\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(basket, /const overZ = side \* \(outerBase \+ radius \* 0\.72\)/);
  assert.match(basket, /const underZ = side \* \(outerBase \+ radius \* 0\.16\)/);
  assert.match(basket, /const gapX = dx \* 0\.16, gapY = dy \* 0\.16/);
  assert.match(basket, /cy - gapY/);
  assert.match(basket, /cy \+ gapY/);
  assert.match(basket, /cx - gapX/);
  assert.match(basket, /cx \+ gapX/);
});

test("volumetric relief stays inside the locked Fidelity V4 silhouette", () => {
  assert.match(geometry, /ABAGS_FIDELITY_V4_FAMILY_SPECS\[family\]/);
  assert.match(geometry, /const SURFACE_INSET = 0\.055/);
  assert.match(geometry, /halfWidthAtY/);
  assert.match(geometry, /\* \(1 - SURFACE_INSET\)/);
  assert.match(geometry, /safeNy = Math\.max\(-0\.84, Math\.min\(0\.84, ny\)\)/);
  assert.match(geometry, /safeNx = Math\.max\(-0\.91, Math\.min\(0\.91, nx\)\)/);
  assert.match(geometry, /spec\.depth \/ 2/);
  assert.doesNotMatch(geometry, /spec\.(rx|ry|depth)\s*=/);
});

test("polyester response is directional and deterministic", () => {
  assert.match(geometry, /float crown=pow/);
  assert.match(geometry, /float filament=/);
  assert.match(geometry, /uLight/);
  assert.match(geometry, /deterministicDrift/);
  assert.doesNotMatch(geometry, /Math\.random/);
});

test("Physical Cord V1 is Photo-True isolated, event driven and mobile safe", () => {
  assert.match(geometry, /stage\.dataset\.abagsPhotoTrue === "active"/);
  assert.match(geometry, /stage\.dataset\.abagsAgataCordWebgl !== "agata-cord-webgl-v1-photo-calibrated"/);
  assert.match(geometry, /window\.innerWidth <= 620 \? 1\.35 : 1\.75/);
  assert.match(geometry, /requestAnimationFrame/);
  assert.match(geometry, /ResizeObserver/);
  assert.match(geometry, /abags:fidelity3d-transform/);
  assert.match(css, /pointer-events:none!important/);
  assert.match(css, /touch-action:none!important/);
  assert.match(css, /data-abags-photo-true="active"/);
  assert.doesNotMatch(geometry, /setInterval/);
  assert.doesNotMatch(geometry, /readPixels|getImageData|putImageData/);
});
