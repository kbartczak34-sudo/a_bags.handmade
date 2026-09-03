import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("live customizer mounts the procedural material realism pass", async () => {
  const source = await read("app/exact-live-customizer.tsx");
  assert.match(source, /BagBuilderMaterialPass/);
  assert.match(source, /<BagBuilderMaterialPass\s*\/>/);
});

test("material pass reacts to the same live construction dimensions", async () => {
  const source = await read("app/bag-builder-material-pass.tsx");
  for (const key of ["data-family", "data-color", "data-stitch", "data-flap", "data-handles", "data-strap", "data-hardware"]) {
    assert.match(source, new RegExp(key.replace("data-", "data-").replace("-", "-")));
  }
  assert.match(source, /drawYarn/);
  assert.match(source, /drawLeatherGrain/);
  assert.match(source, /drawWoodGrain/);
  assert.match(source, /drawMetalGlints/);
});

test("material pass follows rotation zoom touch and preset views without stealing input", async () => {
  const source = await read("app/bag-builder-material-pass.tsx");
  const css = await read("app/bag-builder-material-pass.css");
  assert.match(source, /pointerdown/);
  assert.match(source, /pointermove/);
  assert.match(source, /pointersRef\.current\.size >= 2/);
  assert.match(source, /viewRef\.current\.zoom/);
  assert.match(source, /text === "Przód"/);
  assert.match(source, /text === "3\/4"/);
  assert.match(source, /text === "Bok"/);
  assert.match(css, /pointer-events:none!important/);
});

test("material realism styles are loaded and support both WebGL and Canvas3D fallback", async () => {
  const layout = await read("app/layout.tsx");
  const css = await read("app/bag-builder-material-pass.css");
  assert.match(layout, /bag-builder-material-pass\.css/);
  assert.match(css, /abags-canvas3d-active/);
  assert.match(css, /abags-pro3d-active/);
  assert.match(css, /mix-blend-mode:soft-light/);
});
