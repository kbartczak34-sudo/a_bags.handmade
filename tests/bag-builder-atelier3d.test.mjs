import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("live customizer uses the calibrated atelier 3D renderer", async () => {
  const source = await read("app/exact-live-customizer.tsx");
  assert.match(source, /BagBuilderAtelier3D/);
  assert.match(source, /<BagBuilderAtelier3D\s*\/>/);
});

test("atelier renderer builds distinct extruded silhouettes instead of one generic shell", async () => {
  const source = await read("app/bag-builder-atelier3d.tsx");
  assert.match(source, /function familyContour/);
  assert.match(source, /function makeExtrudedContour/);
  assert.match(source, /family === "tote"/);
  assert.match(source, /family === "round"/);
  assert.match(source, /family === "bucket"/);
  assert.match(source, /PROFILES/);
  assert.match(source, /flapContour/);
});

test("atelier renderer keeps realtime 3D interaction and material changes", async () => {
  const source = await read("app/bag-builder-atelier3d.tsx");
  assert.match(source, /onPointerMove/);
  assert.match(source, /pointers\.current\.size >= 2/);
  assert.match(source, /type="range"/);
  assert.match(source, /PODGLĄD NA ŻYWO · MODEL ATELIER 3D/);
  assert.match(source, /uMaterial/);
  assert.match(source, /uRelief/);
  assert.match(source, /config\.handles/);
  assert.match(source, /config\.strap/);
  assert.match(source, /config\.flap/);
  assert.match(source, /config\.accent/);
});

test("calibrated visual polish is loaded after the previous builder layers", async () => {
  const layout = await read("app/layout.tsx");
  const css = await read("app/bag-builder-atelier3d.css");
  assert.match(layout, /bag-builder-atelier3d\.css/);
  assert.ok(layout.indexOf("bag-builder-atelier3d.css") > layout.indexOf("bag-builder-reference-experience.css"));
  assert.match(css, /abags-atelier3d-calibrated/);
  assert.match(css, /button\.is-active/);
});
