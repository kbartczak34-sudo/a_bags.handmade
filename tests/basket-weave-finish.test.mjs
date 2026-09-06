import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [stack, finish] = await Promise.all([
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-basket-weave-finish.tsx", import.meta.url), "utf8"),
]);

test("segmented basket finish follows the calibrated crochet relief pass", () => {
  assert.match(stack, /<BagBuilderCrochetReliefOverlay\s*\/>[\s\S]*<BagBuilderBasketWeaveFinish\s*\/>/);
  assert.match(finish, /FINISH_VERSION = "basket-cord-weave-v1"/);
  assert.match(finish, /ABAGS_FIDELITY_V4_FAMILY_SPECS\[family\]/);
  assert.match(finish, /stage\.dataset\.abagsFinal3d !== "ready"/);
  assert.match(finish, /stitch !== "basket"/);
});

test("basket construction reads as alternating rounded cord bundles rather than a continuous grid", () => {
  assert.match(finish, /function drawCordBundle/);
  assert.match(finish, /function drawBasketWeave/);
  assert.match(finish, /\(row \+ column\) % 2 === 0/);
  assert.match(finish, /for \(let strand = -1; strand <= 1; strand \+= 1\)/);
  assert.match(finish, /quadraticCurveTo/);
  assert.match(finish, /shadowWidth/);
  assert.match(finish, /highlightWidth/);
  assert.match(finish, /rgba\(stage\.dataset\.color \|\| "#E8DDCC", 0\.075\)/);
});

test("basket pass preserves product fidelity and excludes rigid flap surfaces", () => {
  assert.match(finish, /flap !== "none" && flap !== "crochet"/);
  assert.match(finish, /context\.clip\(clipPath, excludesRigidFlap \? "evenodd" : "nonzero"\)/);
  assert.match(finish, /stage\.dataset\.abagsPhotoTrue === "active"/);
  assert.match(finish, /contour3d\(family, 0\.020\)/);
  assert.doesNotMatch(finish, /Math\.random/);
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
