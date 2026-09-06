import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [stack, sidewall, css] = await Promise.all([
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-sidewall-crochet-depth.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-sidewall-crochet-depth.css", import.meta.url), "utf8"),
]);

test("sidewall crochet depth runs after opening depth and before accessory overlays", () => {
  assert.match(stack, /<BagBuilderOpeningDepth\s*\/>[\s\S]*<BagBuilderSidewallCrochetDepth\s*\/>[\s\S]*<BagBuilderAccessoryFidelityOverlay\s*\/>/);
  assert.match(stack, /import "\.\/bag-builder-sidewall-crochet-depth\.css"/);
  assert.match(sidewall, /SIDE_VERSION = "sidewall-crochet-depth-v2-basket-over-under"/);
});

test("sidewall relief derives from calibrated Fidelity V4 extrusion geometry and cannot expand the silhouette", () => {
  assert.match(sidewall, /ABAGS_FIDELITY_V4_FAMILY_SPECS\[family\]/);
  assert.match(sidewall, /spec\.rx/);
  assert.match(sidewall, /spec\.ry/);
  assert.match(sidewall, /spec\.power/);
  assert.match(sidewall, /spec\.taper/);
  assert.match(sidewall, /spec\.depth/);
  assert.match(sidewall, /spec\.bevel/);
  assert.match(sidewall, /halfWidthAtY/);
  assert.match(sidewall, /context\.clip\(surface\.path\)/);
  assert.match(sidewall, /body silhouette, depth, taper and accessory anchors remain untouched/);
});

test("sidewall relief is view-aware and supports all customer crochet stitches", () => {
  assert.match(sidewall, /Math\.sin\(rotation\.y\)/);
  assert.match(sidewall, /MIN_SIDE_VISIBILITY = 0\.22/);
  assert.match(sidewall, /function drawClassic/);
  assert.match(sidewall, /function drawHerringbone/);
  assert.match(sidewall, /function drawBasket/);
  assert.match(sidewall, /function drawShell/);
  assert.match(sidewall, /surface\.rearZ \+ \(surface\.frontZ - surface\.rearZ\)/);
  assert.doesNotMatch(sidewall, /Math\.random/);
});

test("basket sidewall uses alternating over-under bundles rather than continuous plaid columns", () => {
  assert.match(sidewall, /Basket stitch must read as interlaced cord bundles, not a continuous plaid grid/);
  assert.match(sidewall, /const fractions = \[0\.32, 0\.68\]/);
  assert.match(sidewall, /if \(\(row \+ column\) % 2 !== 0\) continue/);
  assert.match(sidewall, /step \* 1\.16/);
  assert.doesNotMatch(sidewall, /Array\.from\(\{ length: 18 \}/);
});

test("sidewall pass is event driven, Photo-True safe and non-interactive on mobile", () => {
  assert.match(sidewall, /stage\.dataset\.abagsFinal3d !== "ready"/);
  assert.match(sidewall, /stage\.dataset\.abagsPhotoTrue === "active"/);
  assert.match(sidewall, /requestAnimationFrame/);
  assert.match(sidewall, /ResizeObserver/);
  assert.match(sidewall, /abags:fidelity3d-transform/);
  assert.doesNotMatch(sidewall, /setInterval|getImageData|putImageData|readPixels/);
  assert.match(css, /pointer-events:none!important/);
  assert.match(css, /touch-action:none!important/);
  assert.match(css, /z-index:7!important/);
  assert.match(css, /@media \(max-width:620px\)/);
});
