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

test("final customer stack mounts deterministic WebGL v2 before its verifier", () => {
  assert.match(stack, /<BagBuilderFinalWebGL3D\s*\/>[\s\S]*<BagBuilderFinal3DController\s*\/>/);
  assert.doesNotMatch(stack, /<BagBuilderFidelity3D\s*\/>/);
  assert.match(renderer, /preserveDrawingBuffer:true/);
  assert.match(renderer, /data-abags-final-webgl="v2"/);
  assert.match(renderer, /abagsFidelity3dReady="variable-depth-v2"/);
  assert.match(renderer, /abagsFidelity3dFrame=configSignature\(config\)/);
  assert.match(renderer, /gl\.finish\(\)/);
});

test("final verifier promotes only the current completed WebGL v2 frame", () => {
  assert.match(controller, /REQUIRED_RENDERER = "variable-depth-v2"/);
  assert.match(controller, /CURRENT_PROGRAM/);
  assert.match(controller, /gl\.isContextLost\(\)/);
  assert.match(controller, /drawingBufferWidth < 16/);
  assert.match(controller, /abagsFidelity3dFrame/);
  assert.match(controller, /frameSignature !== expectedSignature/);
  assert.match(controller, /abagsFidelity3dError/);
  assert.match(controller, /abagsFinal3d = "promoting"/);
  assert.match(controller, /window\.dispatchEvent\(new Event\("resize"\)\)/);
  assert.match(controller, /requestAnimationFrame[\s\S]*requestAnimationFrame/);
  assert.match(controller, /abagsFinal3dSignature/);
  assert.match(controller, /abagsFinal3d = "ready"/);
  assert.match(controller, /renderer-frame-v2/);
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
