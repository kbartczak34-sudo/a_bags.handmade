import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("live customizer uses the reference-calibrated fidelity 3D renderer", async () => {
  const source = await read("app/exact-live-customizer.tsx");
  assert.match(source, /BagBuilderFidelity3D/);
  assert.match(source, /<BagBuilderFidelity3D\s*\/>/);
  assert.doesNotMatch(source, /<BagBuilderAtelier3D\s*\/>/);
});

test("fidelity renderer builds distinct variable-depth silhouettes instead of one generic extrusion", async () => {
  const source = await read("app/bag-builder-fidelity3d.tsx");
  assert.match(source, /function familyContour/);
  assert.match(source, /function makeVariableDepthBody/);
  assert.match(source, /function depthAt/);
  assert.match(source, /bottomDepth/);
  assert.match(source, /topDepth/);
  assert.match(source, /family === "tote"/);
  assert.match(source, /family === "round"/);
  assert.match(source, /family === "bucket"/);
  assert.match(source, /Mini is intentionally wider relative to height/);
  assert.match(source, /flapContour/);
});

test("fidelity renderer keeps realtime 3D interaction and material changes", async () => {
  const source = await read("app/bag-builder-fidelity3d.tsx");
  assert.match(source, /onPointerMove/);
  assert.match(source, /pointers\.current\.size >= 2/);
  assert.match(source, /type="range"/);
  assert.match(source, /MODEL ATELIER 3D · REALNE PROPORCJE/);
  assert.match(source, /uMaterial/);
  assert.match(source, /uRelief/);
  assert.match(source, /config\.handles/);
  assert.match(source, /config\.strap/);
  assert.match(source, /config\.flap/);
  assert.match(source, /config\.accent/);
});

test("fidelity polish is loaded through the reference calibration layer", async () => {
  const calibration = await read("app/bag-builder-reference-calibration.css");
  const css = await read("app/bag-builder-fidelity3d.css");
  assert.match(calibration, /@import "\.\/bag-builder-fidelity3d\.css"/);
  assert.match(css, /abags-fidelity3d-active/);
  assert.match(css, /button\.is-active/);
});
