import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [stack, finish, css] = await Promise.all([
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-handmade-edge-finish.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-handmade-edge-finish.css", import.meta.url), "utf8"),
]);

test("handmade body edge runs after stitch relief and before accessory overlays", () => {
  assert.match(stack, /<BagBuilderBasketWeaveFinish\s*\/>[\s\S]*<BagBuilderHandmadeEdgeFinish\s*\/>[\s\S]*<BagBuilderAccessoryFidelityOverlay\s*\/>/);
  assert.match(stack, /import "\.\/bag-builder-handmade-edge-finish\.css"/);
  assert.match(finish, /EDGE_VERSION = "handmade-body-edge-v1-inside-only"/);
});

test("edge pass follows exact Fidelity V4 body geometry and never expands the silhouette", () => {
  assert.match(finish, /ABAGS_FIDELITY_V4_FAMILY_SPECS\[family\]/);
  assert.match(finish, /spec\.rx/);
  assert.match(finish, /spec\.ry/);
  assert.match(finish, /spec\.power/);
  assert.match(finish, /spec\.taper/);
  assert.match(finish, /context\.clip\(contour\.path\)/);
  assert.match(finish, /Every stroke is clipped inside the calibrated body contour/);
  assert.doesNotMatch(finish, /\.abags-fidelity3d-canvas\s*\{[^}]*transform:/s);
});

test("edge lighting is directional and includes subtle cord compression without random distortion", () => {
  assert.match(finish, /function drawDirectionalEdge/);
  assert.match(finish, /function drawCompressionMarks/);
  assert.match(finish, /rgba\(255,255,255,\.16\)/);
  assert.match(finish, /rgba\(28,19,22,\.15\)/);
  assert.match(finish, /rgba\(27,18,21,\.085\)/);
  assert.doesNotMatch(finish, /Math\.random/);
});

test("edge pass is event driven, Photo-True safe and non-interactive on mobile", () => {
  assert.match(finish, /stage\.dataset\.abagsFinal3d !== "ready"/);
  assert.match(finish, /stage\.dataset\.abagsPhotoTrue === "active"/);
  assert.match(finish, /requestAnimationFrame/);
  assert.match(finish, /ResizeObserver/);
  assert.match(finish, /abags:fidelity3d-transform/);
  assert.doesNotMatch(finish, /setInterval|getImageData|putImageData|readPixels/);
  assert.match(css, /pointer-events:none!important/);
  assert.match(css, /touch-action:none!important/);
  assert.match(css, /@media \(max-width:620px\)/);
});
