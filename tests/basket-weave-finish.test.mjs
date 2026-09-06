import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [stack, finish] = await Promise.all([
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-basket-weave-finish.tsx", import.meta.url), "utf8"),
]);

test("Basket V5 remains mounted after calibrated crochet relief and inside the Fidelity stack", () => {
  assert.match(stack, /<BagBuilderCrochetReliefOverlay\s*\/>[\s\S]*<BagBuilderBasketWeaveFinish\s*\/>/);
  assert.match(finish, /FINISH_VERSION\s*=\s*"basket-cord-weave-v5-packed-over-under"/);
  assert.match(finish, /ABAGS_FIDELITY_V4_FAMILY_SPECS\[family\]/);
  assert.match(finish, /stage\.dataset\.abagsFinal3d\s*!==\s*"ready"/);
  assert.match(finish, /stitch\s*!==\s*"basket"/);
});

test("packed basket uses dense paired cord bands with alternating local over-under crossings", () => {
  assert.match(finish, /function lanePath/);
  assert.match(finish, /function shortLanePath/);
  assert.match(finish, /function drawCordBundle/);
  assert.match(finish, /function drawTopBundlePatch/);
  assert.match(finish, /function drawCrossingShadow/);
  assert.match(finish, /function drawPackedBasket/);
  assert.match(finish, /const cell = 31 \* unit/);
  assert.match(finish, /const strandSpacing = 2\.35 \* unit/);
  assert.match(finish, /bezierCurveTo/);
  assert.match(finish, /quadraticCurveTo/);
  assert.match(finish, /const overHorizontal = \(rowIndex \+ columnIndex\) % 2 === 0/);
  assert.match(finish, /rows\.forEach/);
  assert.match(finish, /columns\.forEach/);
  assert.match(finish, /createRadialGradient/);
  assert.match(finish, /context\.ellipse/);
});

test("Basket V5 suppresses sparse honeycomb with a dense same-hue bed and neutral directional light", () => {
  assert.match(finish, /rgba\(selectedColor, 0\.82\)/);
  assert.match(finish, /rgba\(selectedColor, alpha\)/);
  assert.match(finish, /strokeCord\(context, selectedColor, unit, 0\.64\)/);
  assert.match(finish, /strokeCord\(context, selectedColor, unit, 0\.92\)/);
  assert.match(finish, /createLinearGradient/);
  assert.match(finish, /rgba\(255,255,255,\.09\)/);
  assert.match(finish, /rgba\(30,20,24,\.08\)/);
  assert.match(finish, /lineCap = "round"/);
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

test("Basket V5 remains deterministic, event driven and mobile gesture safe", () => {
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
