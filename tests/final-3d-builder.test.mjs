import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [stack, controller, css, smoke] = await Promise.all([
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-final3d-controller.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-customer-realtime.css", import.meta.url), "utf8"),
  readFile(new URL("../scripts/smoke-customizer-realtime.mjs", import.meta.url), "utf8"),
]);

test("final customer stack verifies 3D before promoting it", () => {
  assert.match(stack, /<BagBuilderFidelity3D\s*\/>[\s\S]*<BagBuilderFinal3DController\s*\/>/);
  assert.match(controller, /gl\.readPixels/);
  assert.match(controller, /for \(let iy = 1; iy <= 9/);
  assert.match(controller, /CURRENT_PROGRAM/);
  assert.match(controller, /gl\.isContextLost\(\)/);
  assert.match(controller, /window\.dispatchEvent\(new Event\("resize"\)\)/);
  assert.match(controller, /requestAnimationFrame[\s\S]*requestAnimationFrame/);
  assert.match(controller, /data-abags-final3d-signature|abagsFinal3dSignature/);
  assert.match(controller, /abagsFinal3d = "ready"/);
  assert.match(controller, /healthy-webgl-frame/);
});

test("SVG remains fallback and verified Fidelity3D becomes primary", () => {
  assert.match(css, /data-abags-final3d="ready"/);
  assert.match(css, /> \.abags-fidelity3d-layer/);
  assert.match(css, /opacity:1!important;[\s\S]*visibility:visible!important;[\s\S]*pointer-events:auto!important/);
  assert.match(css, /data-abags-final3d="ready"\] > svg[\s\S]*opacity:0!important/);
  assert.match(css, /\.abags-canvas3d-layer[\s\S]*display:none!important/);
});

test("production acceptance requires real interactive 3D", () => {
  assert.match(smoke, /--use-gl=swiftshader/);
  assert.match(smoke, /abagsFinal3d==='ready'/);
  assert.match(smoke, /abagsFinal3dSignature===s\.dataset\.builderSignature/);
  assert.match(smoke, /canvasVisible/);
  assert.match(smoke, /fidelityVisible/);
  assert.match(smoke, /clickView\("Bok"\)/);
  assert.match(smoke, /clickView\("3\/4"\)/);
  assert.match(smoke, /FINAL 3D BUILDER PASS/);
});
