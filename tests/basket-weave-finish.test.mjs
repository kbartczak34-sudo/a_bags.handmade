import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [stack, finish] = await Promise.all([
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-basket-weave-finish.tsx", import.meta.url), "utf8"),
]);

test("segmented basket finish follows the calibrated crochet relief pass", () => {
  assert.match(stack, /<BagBuilderCrochetReliefOverlay\s*\/>[\s\S]*<BagBuilderBasketWeaveFinish\s*\/>/);
  assert.match(finish, /FINISH_VERSION\s*=\s*"basket-cord-weave-v2-over-under"/);
  assert.match(finish, /ABAGS_FIDELITY_V4_FAMILY_SPECS\[family\]/);
  assert.match(finish, /stage\.dataset\.abagsFinal3d\s*!==\s*"ready"/);
  assert.match(finish, /stitch\s*!==\s*"basket"/);
});

test("basket construction uses real over-under depth instead of isolated rectangular dashes", () => {
  assert.match(finish, /type BundleLayer = "under" \| "over"/);
  assert.match(finish, /function drawCordBundle/);
  assert.match(finish, /function drawCrossingOcclusion/);
  assert.match(finish, /function drawBasketWeave/);
  assert.match(finish, /const overHorizontal = \(row \+ column\) % 2 === 0/);
  assert.match(finish, /selectedColor, "under"/);
  assert.match(finish, /selectedColor, "over"/);
  assert.match(finish, /for \(let strand = -1; strand <= 1; strand \+= 1\)/);
  assert.match(finish, /quadraticCurveTo/);
  assert.match(finish, /createRadialGradient/);
  assert.match(finish, /context\.ellipse/);
});

test("basket cords remain handmade, cylindrical and colour-faithful", () => {
  assert.match(finish, /function deterministicJitter/);
  assert.match(finish, /rgba\(selectedColor, over \? 0\.34 : 0\.20\)/);
  assert.match(finish, /rgba\(selectedColor, 0\.16\)/);
  assert.match(finish, /rgba\(255,255,255,\.32\)/);
  assert.match(finish, /rgba\(30,21,24,\.29\)/);
  assert.match(finish, /lineCap = "round"/);
  assert.match(finish, /opacity:\.10!important/);
  assert.match(finish, /opacity:\.07!important/);
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
