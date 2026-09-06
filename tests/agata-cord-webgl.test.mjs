import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [stack, renderer, css, library] = await Promise.all([
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-agata-cord-webgl.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-agata-cord-webgl.css", import.meta.url), "utf8"),
  readFile(new URL("../lib/exact-customizer-library.ts", import.meta.url), "utf8"),
]);

test("Agata photo-calibrated WebGL material layer is mounted above the verified base renderer", () => {
  assert.match(stack, /<BagBuilderFinalWebGL3D\s*\/>[\s\S]*<BagBuilderAgataCordWebGL\s*\/>/);
  assert.match(stack, /bag-builder-agata-cord-webgl\.css/);
  assert.match(css, /z-index:2!important/);
  assert.match(css, /data-abags-agata-cord-webgl="agata-cord-webgl-v1-photo-calibrated"/);
});

test("real A-Bags stitch vocabulary is represented by independent analytical cord constructions", () => {
  assert.match(library, /stitch:"open-v"/);
  assert.match(library, /stitch:"vertical-open"/);
  assert.match(library, /stitch:"basket"/);
  assert.match(library, /stitch:"radial"/);
  assert.match(renderer, /function agataOpenV/);
  assert.match(renderer, /function agataVerticalOpen/);
  assert.match(renderer, /function agataBasket/);
  assert.match(renderer, /function agataRadial/);
  assert.match(renderer, /sdSegment/);
  assert.match(renderer, /roundedCord/);
});

test("polyester cord has analytical height normals, cavity occlusion and deterministic fibre response", () => {
  assert.match(renderer, /finite-height gradient/i);
  assert.match(renderer, /stitchSurface\(vUv\+vec2\(epsilon,0\.0\)/);
  assert.match(renderer, /tangentBasisX/);
  assert.match(renderer, /cavityAO/);
  assert.match(renderer, /deterministicFibres/);
  assert.match(renderer, /polyesterCrown/);
  assert.doesNotMatch(renderer, /Math\.random/);
  assert.doesNotMatch(renderer, /setInterval/);
  assert.doesNotMatch(renderer, /readPixels/);
});

test("Agata material replacement preserves shared Fidelity V4 shape and accessory anchors", () => {
  assert.match(renderer, /ABAGS_FIDELITY_V4_FAMILY_SPECS\[config\.family\]/);
  assert.match(renderer, /spec\.depth/);
  assert.match(renderer, /spec\.topY/);
  assert.match(renderer, /spec\.handleScale/);
  assert.match(renderer, /spec\.flapScale/);
  assert.match(renderer, /spec\.sideAnchor/);
  assert.match(renderer, /familyContour\("tote"\)/);
  assert.match(renderer, /familyContour\("round"\)/);
  assert.match(renderer, /familyContour\("bucket"\)/);
  assert.match(renderer, /familyContour\("mini"\)/);
});

test("Photo-True remains isolated and mobile pixel density stays bounded", () => {
  assert.match(renderer, /stage\.dataset\.abagsPhotoTrue==="active"/);
  assert.match(renderer, /window\.innerWidth<=620\?1\.5:2/);
  assert.match(renderer, /requestAnimationFrame/);
  assert.match(renderer, /ResizeObserver/);
  assert.match(css, /not\(\[data-abags-photo-true="active"\]\)/);
});
