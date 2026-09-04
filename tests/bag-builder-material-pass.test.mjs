import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("live customizer keeps the procedural material pass out of the visible renderer stack", async () => {
  const source = await read("app/exact-live-customizer.tsx");
  assert.match(source, /BagBuilderFinalWebGL3D/);
  assert.match(source, /<BagBuilderFinalWebGL3D\s*\/>/);
  assert.doesNotMatch(source, /<BagBuilderFidelity3D\s*\/>/);
  assert.doesNotMatch(source, /BagBuilderMaterialPass/);
  assert.doesNotMatch(source, /<BagBuilderMaterialPass\s*\/>/);
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

test("A-Bags cord is calibrated as smooth polyester rather than fuzzy cotton yarn", async () => {
  const source = await read("app/bag-builder-material-pass.tsx");
  assert.match(source, /POLYESTER_CORD = "pimiotki-polyester"/);
  assert.match(source, /drawPolyesterSatin/);
  assert.match(source, /Polyester cord is smooth/);
  assert.match(source, /data-abags-yarn-material/);
  assert.match(source, /polyester-cord-v2/);
  assert.doesNotMatch(source, /for \(let i = 0; i < 170; i \+= 1\)/);
});

test("polyester highlights follow the live view and light instead of being baked into an image", async () => {
  const source = await read("app/bag-builder-material-pass.tsx");
  assert.match(source, /Math\.sin\(view\.ry\)/);
  assert.match(source, /light\.x/);
  assert.match(source, /globalCompositeOperation = "screen"/);
  assert.match(source, /viewRef\.current\.ry/);
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

test("material realism implementation remains available as a fallback calibration", async () => {
  const layout = await read("app/layout.tsx");
  const css = await read("app/bag-builder-material-pass.css");
  assert.match(layout, /bag-builder-material-pass\.css/);
  assert.match(css, /abags-canvas3d-active/);
  assert.match(css, /abags-pro3d-active/);
  assert.match(css, /mix-blend-mode:soft-light/);
});
