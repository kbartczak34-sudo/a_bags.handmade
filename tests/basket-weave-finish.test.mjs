import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [stack, finish] = await Promise.all([
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-basket-weave-finish.tsx", import.meta.url), "utf8"),
]);

test("Basket V6 remains mounted after calibrated crochet relief and inside the Fidelity stack", () => {
  assert.match(stack, /<BagBuilderCrochetReliefOverlay\s*\/>[\s\S]*<BagBuilderBasketWeaveFinish\s*\/>/);
  assert.match(finish, /FINISH_VERSION\s*=\s*"basket-cord-weave-v6-segmented-relief"/);
  assert.match(finish, /ABAGS_FIDELITY_V4_FAMILY_SPECS\[family\]/);
  assert.match(finish, /stage\.dataset\.abagsFinal3d\s*!==\s*"ready"/);
  assert.match(finish, /stitch\s*!==\s*"basket"/);
});

test("Basket V6 uses physical segmented cords instead of uninterrupted plaid lanes", () => {
  assert.match(finish, /function cordSegmentPath/);
  assert.match(finish, /function drawBundleSegment/);
  assert.match(finish, /function drawUnderOcclusion/);
  assert.match(finish, /function drawContactShadow/);
  assert.match(finish, /function drawSegmentedBasket/);
  assert.match(finish, /const cell = 29 \* unit/);
  assert.match(finish, /const centerGap = 5\.8 \* unit/);
  assert.match(finish, /const strandSpacing = 3\.05 \* unit/);
  assert.match(finish, /const overHorizontal = \(rowIndex \+ columnIndex\) % 2 === 0/);
  assert.match(finish, /const underHorizontal = !overHorizontal/);
  assert.match(finish, /-halfSpan,[\s\S]*-centerGap/);
  assert.match(finish, /centerGap,[\s\S]*halfSpan/);
  assert.match(finish, /quadraticCurveTo/);
  assert.doesNotMatch(finish, /function lanePath/);
});

test("Basket V6 adds cylindrical cord crown, contact depth and subtle polyester fibre response", () => {
  assert.match(finish, /lineWidth = Math\.max\(1\.45, 6\.15 \* unit\)/);
  assert.match(finish, /lineWidth = Math\.max\(1\.20, 4\.55 \* unit\)/);
  assert.match(finish, /rgba\(255,255,255,\$\{crownAlpha\}\)/);
  assert.match(finish, /setLineDash\(\[1\.20 \* unit, 2\.15 \* unit\]\)/);
  assert.match(finish, /createRadialGradient/);
  assert.match(finish, /context\.ellipse/);
  assert.match(finish, /rgba\(selectedColor, 0\.94\)/);
  assert.match(finish, /createLinearGradient/);
  assert.match(finish, /rgba\(255,255,255,\.12\)/);
  assert.match(finish, /rgba\(28,19,23,\.10\)/);
  assert.doesNotMatch(finish, /Math\.random/);
});

test("basket body material preserves exact product fidelity and excludes rigid flap surfaces", () => {
  assert.match(finish, /flap\s*!==\s*"none"\s*&&\s*flap\s*!==\s*"crochet"/);
  assert.match(finish, /context\.clip\(clipPath,\s*excludesRigidFlap\s*\?\s*"evenodd"\s*:\s*"nonzero"\)/);
  assert.match(finish, /stage\.dataset\.abagsPhotoTrue\s*===\s*"active"/);
  assert.match(finish, /contour3d\(family,\s*0\.020\)/);
  assert.match(finish, /z-index:4!important/);
  assert.doesNotMatch(finish, /\.abags-fidelity3d-canvas\s*\{[^}]*transform:/s);
});

test("Basket V6 remains deterministic, event driven and mobile gesture safe", () => {
  assert.match(finish, /function deterministicJitter/);
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
