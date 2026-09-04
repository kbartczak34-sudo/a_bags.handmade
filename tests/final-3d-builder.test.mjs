import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [stack, renderer, controller, css, smoke] = await Promise.all([
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-final-webgl3d.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-final3d-controller.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-customer-realtime.css", import.meta.url), "utf8"),
  readFile(new URL("../scripts/smoke-customizer-realtime.mjs", import.meta.url), "utf8"),
]);

test("final customer stack mounts calibrated A-Bags Fidelity v3 before its verifier", () => {
  assert.match(stack, /<BagBuilderFinalWebGL3D\s*\/>[\s\S]*<BagBuilderFinal3DController\s*\/>/);
  assert.doesNotMatch(stack, /<BagBuilderFidelity3D\s*\/>/);
  assert.match(renderer, /preserveDrawingBuffer: true/);
  assert.match(renderer, /RENDERER_VERSION = "abags-fidelity-v3"/);
  assert.match(renderer, /data-abags-final-webgl="v3"/);
  assert.match(renderer, /abagsFidelity3dReady = RENDERER_VERSION/);
  assert.match(renderer, /abagsFidelity3dFrame = configSignature\(config\)/);
  assert.match(renderer, /abagsFidelity3dModel = "real-product-calibrated"/);
  assert.match(renderer, /gl\.finish\(\)/);
});

test("A-Bags body geometry is smooth, family-specific and mobile-camera aware", () => {
  assert.match(renderer, /function superellipseContour/);
  assert.match(renderer, /function beveledExtrusion/);
  assert.match(renderer, /superellipseContour\(1\.02, \.79, 4\.6, 52, -\.055\)/);
  assert.match(renderer, /superellipseContour\(\.88, \.89, 2\.08, 56, 0\)/);
  assert.match(renderer, /superellipseContour\(\.84, \.83, 4\.4, 52, -\.045\)/);
  assert.match(renderer, /superellipseContour\(\.76, \.64, 5\.4, 52, -\.025\)/);
  assert.match(renderer, /const narrow = aspect < \.82/);
  assert.match(renderer, /cameraZ = narrow \? -6\.45/);
});

test("four product stitches have independent yarn constructions", () => {
  assert.match(renderer, /ażurowy V/i);
  assert.match(renderer, /pionowy ażurowy/i);
  assert.match(renderer, /koszykowy/i);
  assert.match(renderer, /promienisty/i);
  assert.match(renderer, /float yarnFibres/);
  assert.match(renderer, /float cord/);
});

test("final verifier accepts only current v3 frames with real framebuffer product pixels", () => {
  assert.match(controller, /REQUIRED_RENDERER = "abags-fidelity-v3"/);
  assert.match(controller, /CURRENT_PROGRAM/);
  assert.match(controller, /gl\.isContextLost\(\)/);
  assert.match(controller, /drawingBufferWidth < 16/);
  assert.match(controller, /function inspectVisiblePixels/);
  assert.match(controller, /gl\.readPixels/);
  assert.match(controller, /opaqueSamples >= 5/);
  assert.match(controller, /framebuffer-empty-/);
  assert.match(controller, /abagsFinal3dPixels/);
  assert.match(controller, /abagsFidelity3dFrame/);
  assert.match(controller, /frameSignature !== expectedSignature/);
  assert.match(controller, /abagsFidelity3dError/);
  assert.match(controller, /abagsFinal3d = "promoting"/);
  assert.match(controller, /window\.dispatchEvent\(new Event\("resize"\)\)/);
  assert.match(controller, /requestAnimationFrame[\s\S]*requestAnimationFrame/);
  assert.match(controller, /abagsFinal3dSignature/);
  assert.match(controller, /abagsFinal3d = "ready"/);
  assert.match(controller, /renderer-frame-v3-pixels-/);
});

test("SVG remains fallback and completed WebGL becomes visible primary", () => {
  assert.match(css, /data-abags-final3d="ready"/);
  assert.match(css, /> \.abags-fidelity3d-layer/);
  assert.match(css, /opacity:1!important;[\s\S]*visibility:visible!important;[\s\S]*pointer-events:auto!important/);
  assert.match(css, /data-abags-final3d="ready"\] > svg[\s\S]*opacity:0!important/);
  assert.match(css, /\.abags-canvas3d-layer[\s\S]*display:none!important/);
});

test("production acceptance requires the completed interactive WebGL surface", () => {
  assert.match(smoke, /--use-gl=swiftshader/);
  assert.match(smoke, /abagsFinal3d==='ready'/);
  assert.match(smoke, /abagsFinal3dSignature===s\.dataset\.builderSignature/);
  assert.match(smoke, /canvasVisible/);
  assert.match(smoke, /fidelityVisible/);
  assert.match(smoke, /svgVisible/);
  assert.match(smoke, /clickView\("Bok"\)/);
  assert.match(smoke, /clickView\("3\/4"\)/);
  assert.match(smoke, /FINAL 3D BUILDER PASS/);
});
