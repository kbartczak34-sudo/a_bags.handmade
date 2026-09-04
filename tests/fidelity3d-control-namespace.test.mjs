import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const live = readFileSync("app/exact-live-customizer.tsx", "utf8");
const namespace = readFileSync("app/bag-builder-fidelity3d-control-namespace.tsx", "utf8");
const css = readFileSync("app/bag-builder-fidelity3d-controls.css", "utf8");
const viewSync = readFileSync("app/bag-builder-view-sync.tsx", "utf8");
const smoke = readFileSync("scripts/smoke-customizer-realtime.mjs", "utf8");

test("Fidelity3D control namespace is mounted immediately after the final WebGL renderer", () => {
  const renderer = live.indexOf("<BagBuilderFinalWebGL3D />");
  const controlNamespace = live.indexOf("<BagBuilderFidelity3DControlNamespace />");
  const compositor = live.indexOf("<BagBuilderFidelity3DCompositorSync />");
  assert.ok(renderer >= 0 && controlNamespace > renderer && compositor > controlNamespace);
});

test("active Fidelity3D controls are migrated away from legacy Pro3D selector names", () => {
  assert.match(namespace, /abags-pro3d-view-controls/);
  assert.match(namespace, /abags-fidelity3d-view-controls/);
  assert.match(namespace, /abags-pro3d-zoom/);
  assert.match(namespace, /abags-fidelity3d-zoom/);
  assert.match(namespace, /classList\.remove\(legacyClass\)/);
  assert.match(namespace, /classList\.add\(fidelityClass\)/);
});

test("isolated mobile controls have bounded product-safe geometry", () => {
  assert.match(css, /\.abags-fidelity3d-view-controls\s*\{/);
  assert.match(css, /max-height:35px/);
  assert.match(css, /\.abags-fidelity3d-zoom\s*\{/);
  assert.match(css, /max-width:184px/);
  assert.match(css, /max-height:38px/);
});

test("view synchronization prefers the Fidelity3D zoom namespace", () => {
  assert.match(viewSync, /\.abags-fidelity3d-zoom input\[type=\\"range\\"\]/);
});

test("production realtime acceptance exercises only isolated Fidelity3D view controls", () => {
  assert.match(smoke, /\.abags-fidelity3d-view-controls button/);
  assert.match(smoke, /legacyControlCount/);
  assert.match(smoke, /viewControls\.height > 44/);
  assert.match(smoke, /zoomControls\.height > 48/);
  assert.doesNotMatch(smoke, /querySelectorAll\('\.abags-pro3d-view-controls button'\)/);
});
