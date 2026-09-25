import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [stack, renderer, controller, compositor, stageCss] = await Promise.all([
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-fidelity3d.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-final3d-controller.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-fidelity3d-compositor-sync.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-reference-v4-product-stage.css", import.meta.url), "utf8"),
]);

test("customer stack keeps the compositor bridge between the engine and verifier", () => {
  assert.match(stack, /<BagBuilderFidelity3DCompositorSync \/>/);
  assert.match(stack, /<BagBuilderFinal3DController \/>/);
  assert.match(stack, /<BagBuilderEngine \/>/);
});

test("compositor bridge never consumes WebGL before the verifier reads the product framebuffer", () => {
  assert.doesNotMatch(compositor, /canvas\s*\.\s*getContext\s*\(/);
  assert.doesNotMatch(compositor, /gl\s*\??\s*\.\s*flush\s*\(/);
  assert.doesNotMatch(compositor, /data-abags-fidelity3d-frame-at/);
  assert.match(
    compositor,
    /stageObserver\.observe\(stage,\s*\{\s*attributes:\s*true,\s*attributeFilter:\s*\[\.\.\.PROMOTION_ATTRIBUTES\],\s*\}\);/,
  );
  assert.match(
    compositor,
    /bodyObserver\.observe\(document\.body,\s*\{\s*childList:\s*true,\s*subtree:\s*true\s*\}\);/,
  );
  assert.match(compositor, /Intentionally no eager promoteComposite\(\) call/);
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


test("customer Fidelity3D renderer consumes the same V4 family geometry contract", () => {
  assert.match(renderer, /ABAGS_FIDELITY_V4_FAMILY_SPECS/);
  assert.match(renderer, /Object.keys(ABAGS_FIDELITY_V4_FAMILY_SPECS)/);
  assert.match(renderer, /spec.rx/);
  assert.match(renderer, /spec.depth/);
  assert.match(renderer, /spec.handleScale/);
  assert.match(renderer, /spec.flapScale/);
  assert.match(renderer, /spec.sideAnchor/);
  assert.match(renderer, /const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS\[family\]/);
  assert.match(renderer, /const exponent = 2 \/ Math\.max\(1\.01, spec\.power\)/);
  assert.match(renderer, /spec\.ry/);
  assert.match(renderer, /spec\.taper/);
  assert.match(renderer, /return spec\.depth/);
  assert.doesNotMatch(renderer, /if \(family === "tote"\) \{[\s\S]*quad\(p, \[-0\.92, 0\.76\]/);
});

test("Fidelity3D body has physical rounded edge construction and family-specific opening rims", () => {
  assert.match(renderer, /const bevel = Math\.min\(\.055, spec\.depth \* \.14\)/);
  assert.match(renderer, /const frontFace = addRing\(inset, 1, bevel, "face"\)/);
  assert.match(renderer, /const frontEdge = addRing\(1, 1, 0, "bevel"\)/);
  assert.match(renderer, /const backEdge = addRing\(1, -1, 0, "bevel"\)/);
  assert.match(renderer, /function makeOpeningRim\(family/);
  assert.match(renderer, /makeOpeningRim\("tote"\)/);
  assert.match(renderer, /makeOpeningRim\("round"\)/);
  assert.match(renderer, /makeOpeningRim\("bucket"\)/);
  assert.match(renderer, /makeOpeningRim\("mini"\)/);
  assert.match(renderer, /meshes\[config\.family \+ "Rim"\]/);
  assert.match(renderer, /handleScaleY: spec\.handleScale\[1\]/);
  assert.match(renderer, /\[size, sizeY, 1\]/);
});

test("Fidelity3D yarn relief affects both geometry and lighting normals", () => {
  assert.match(renderer, /float h=knit\(aUv,uStitch\)\*uRelief/);
  assert.match(renderer, /float hx=\(knit\(aUv\+vec2\(eps,0\.0\),uStitch\)-knit\(aUv-vec2\(eps,0\.0\),uStitch\)\)/);
  assert.match(renderer, /float hy=\(knit\(aUv\+vec2\(0\.0,eps\),uStitch\)-knit\(aUv-vec2\(0\.0,eps\),uStitch\)\)/);
  assert.match(renderer, /vec3 reliefNormal=normalize/);
  assert.match(renderer, /mix\(aNormal,reliefNormal,frontFace\*\.72\)/);
});
