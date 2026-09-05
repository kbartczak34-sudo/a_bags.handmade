import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [stack, finish] = await Promise.all([
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-accessory-material-finish.tsx", import.meta.url), "utf8"),
]);

test("accessory material finishing stays downstream of calibrated accessory geometry", () => {
  assert.match(stack, /<BagBuilderAccessoryFidelityOverlay\s*\/>[\s\S]*<BagBuilderAccessoryMaterialFinish\s*\/>/);
  assert.match(finish, /FINISH_VERSION = "accessory-material-finish-v2"/);
  assert.match(finish, /ABAGS_FIDELITY_V4_FAMILY_SPECS\[family\]/);
  assert.match(finish, /ABAGS_ACCESSORY_VISUAL\.strapDepthBowRatio/);
  assert.match(finish, /stage\.dataset\.abagsFinal3d !== "ready"/);
});

test("metal, leather and woven accessories use distinct visible material depth", () => {
  assert.match(finish, /function hardwarePalette/);
  assert.match(finish, /function drawChainSpecular/);
  assert.match(finish, /function drawLeatherFinish/);
  assert.match(finish, /function drawWovenFinish/);
  assert.match(finish, /function drawAnchorContact/);
  assert.match(finish, /function drawSnapGlint/);
  assert.match(finish, /palette\.mid/);
  assert.match(finish, /rgba\(103,66,51,\.97\)/);
  assert.match(finish, /rgba\(118,82,91,\.96\)/);
  assert.match(finish, /rgba\(255,244,239,\.46\)/);
});

test("chain shoulder section remains leather instead of receiving duplicate metallic links", () => {
  assert.match(finish, /arcIndex >= 18 && arcIndex <= 31/);
  assert.match(finish, /drawLeatherFinish\(back\.context, arc\.slice\(18, 31\)/);
  assert.match(finish, /widthFactor = 1/);
});

test("finish layer preserves realtime gestures and mobile rendering budget", () => {
  assert.match(finish, /requestAnimationFrame/);
  assert.match(finish, /ResizeObserver/);
  assert.match(finish, /dprCap = window\.innerWidth <= 620 \? 1\.5 : 2/);
  assert.match(finish, /pointer-events:none!important/);
  assert.match(finish, /touch-action:none!important/);
  assert.match(finish, /aria-hidden="true"/);
  assert.doesNotMatch(finish, /setInterval/);
  assert.doesNotMatch(finish, /getImageData|putImageData|readPixels/);
});

test("depth finishing remains split behind the product and at front contact points", () => {
  assert.match(finish, /abags-accessory-material-finish-back \{ z-index:9!important; \}/);
  assert.match(finish, /abags-accessory-material-finish-front \{ z-index:272!important; \}/);
  assert.match(finish, /drawChainSpecular\(back\.context/);
  assert.match(finish, /drawAnchorContact\(front\.context/);
});
