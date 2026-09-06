import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [stack, finish] = await Promise.all([
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-basket-weave-finish.tsx", import.meta.url), "utf8"),
]);

test("basket finish follows the calibrated crochet relief pass", () => {
  assert.match(stack, /<BagBuilderCrochetReliefOverlay\s*\/>[\s\S]*<BagBuilderBasketWeaveFinish\s*\/>/);
  assert.match(finish, /FINISH_VERSION\s*=\s*"basket-cord-weave-v3-continuous-bundles"/);
  assert.match(finish, /ABAGS_FIDELITY_V4_FAMILY_SPECS\[family\]/);
  assert.match(finish, /stage\.dataset\.abagsFinal3d\s*!==\s*"ready"/);
  assert.match(finish, /stitch\s*!==\s*"basket"/);
});

test("basket construction uses continuous cord lanes with local over-under crossings", () => {
  assert.match(finish, /function continuousCordPath/);
  assert.match(finish, /function drawContinuousBundle/);
  assert.match(finish, /function drawTopBundlePatch/);
  assert.match(finish, /function drawCrossingOcclusion/);
  assert.match(finish, /function drawBasketWeave/);
  assert.match(finish, /bezierCurveTo/);
  assert.match(finish, /quadraticCurveTo/);
  assert.match(finish, /const overHorizontal = \(rowIndex \+ columnIndex\) % 2 === 0/);
  assert.match(finish, /rows\.forEach/);
  assert.match(finish, /columns\.forEach/);
  assert.match(finish, /createRadialGradient/);
  assert.match(finish, /context\.ellipse/);
});

test("basket cords remain handmade, cylindrical and colour-faithful", () => {
  assert.match(finish, /function deterministicJitter/);
  assert.match(finish, /rgba\(selectedColor, 0\.15\)/);
  assert.match(finish, /rgba\(selectedColor, 0\.40\)/);
  assert.match(finish, /rgba\(selectedColor, 0\.22\)/);
  assert.match(finish, /rgba\(255,255,255,\.30\)/);
  assert.match(finish, /rgba\(27,19,22,\.28\)/);
  assert.match(finish, /lineCap = "round"/);
  assert.match(finish, /opacity:\.04!important/);
  assert.match(finish, /opacity:\.03!important/);
  assert.doesNotMatch(finish, /Math\.random/);
});

test("basket pass preserves product fidelity and excludes rigid flap surfaces", () => {
  assert.match(finish, /flap\s*!==\s*"none"\s*&&\s*flap\s*!==\s*"crochet"/);
  assert.match(finish, /context\.clip\(clipPath,\s*excludesRigidFlap\s*\?\s*"evenodd"\s*:\s*"nonzero"\)/);
  assert.match(finish, /stage\.dataset\.abagsPhotoTrue\s*===\s*"active"/);
  assert.match(finish, /contour3d\(family,\s*0\.020\)/);
  assert.doesNotMatch(finish, /\.abags-fidelity3d-canvas\s*\{[^}]*transform:/s);
});

test("basket pass remains event driven and mobile safe", () => {
  assert.match(finish, /requestAnimationFrame/);
  assert.match(finish, /ResizeObserver/);
  assert.match(finish, /abags:fidelity3d-transform/);
  assert.match(finish, /pointer-events:none!important/);
  assert.match(finish, /touch-action:none!important/);
  assert.match(finish, /aria-hidden="true"/);
  assert.match(finish, /@media \(max-width:620px\)/);
  assert.match(finish, /abags-crochet-relief-surface/);
  assert.doesNotMatch(finish, /setInterval/);
  assert.doesNotMatch(finish, /getImageData|putImageData|readPixels/);
});
