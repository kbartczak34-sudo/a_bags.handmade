import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [stack, controller, compositor, stageCss] = await Promise.all([
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-final3d-controller.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-fidelity3d-compositor-sync.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-reference-v4-product-stage.css", import.meta.url), "utf8"),
]);

test("customer stack forces a compositor commit before final 3D verification", () => {
  assert.match(stack, /<BagBuilderFinalWebGL3D\s*\/>[\s\S]*<BagBuilderFidelity3DCompositorSync\s*\/>[\s\S]*<BagBuilderFinal3DController\s*\/>/);
  assert.match(compositor, /gl\?\.flush\(\)/);
  assert.match(compositor, /translate3d\(0,0,/);
  assert.match(compositor, /data-abags-fidelity3d-frame-at/);
  assert.match(compositor, /abagsFidelity3dComposite/);
  assert.match(compositor, /requestAnimationFrame[\s\S]*requestAnimationFrame/);
});

test("verified framebuffer must preserve the selected chromatic cord hue", () => {
  assert.match(controller, /function parseHexColor/);
  assert.match(controller, /function hueSample/);
  assert.match(controller, /function hueDistance/);
  assert.match(controller, /expectedSample\.saturation >= \.16/);
  assert.match(controller, /delta <= 48/);
  assert.match(controller, /Math\.ceil\(opaqueSamples \* \.2\)/);
  assert.match(controller, /framebuffer-color-mismatch-/);
  assert.match(controller, /abagsFinal3dHueMatches/);
  assert.match(controller, /abagsFinal3dExpectedHue/);
  assert.match(controller, /inspectVisiblePixels\(canvas, stage\.dataset\.color \|\| ""\)/);
});

test("legacy product scenery cannot recolor or cover the Fidelity3D surface", () => {
  assert.match(stageCss, /\.abags-bag-builder-stage\.abags-pro3d-active::before/);
  assert.match(stageCss, /\.abags-bag-builder-stage\.abags-fidelity3d-active::after/);
  assert.match(stageCss, /data-abags-final3d="ready"\]::before/);
  assert.match(stageCss, /\.abags-fidelity3d-canvas[\s\S]*filter:none!important/);
  assert.match(stageCss, /mix-blend-mode:normal!important/);
  assert.match(stageCss, /backface-visibility:hidden!important/);
});
