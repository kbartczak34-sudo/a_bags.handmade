import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("live customizer keeps construction calibration out of the visible renderer stack", async () => {
  const source = await read("app/exact-live-customizer.tsx");
  assert.match(source, /BagBuilderFidelity3D/);
  assert.match(source, /<BagBuilderFidelity3D\s*\/>/);
  assert.doesNotMatch(source, /BagBuilderConstructionPass/);
  assert.doesNotMatch(source, /<BagBuilderConstructionPass\s*\/>/);
});

test("construction pass calibrates each fason independently", async () => {
  const source = await read("app/bag-builder-construction-pass.tsx");
  assert.match(source, /function familyMetrics/);
  assert.match(source, /family === "round"/);
  assert.match(source, /family === "bucket"/);
  assert.match(source, /family === "mini"/);
  assert.match(source, /bottom:/);
  assert.match(source, /top:/);
  assert.match(source, /gusset:/);
});

test("construction details remain attached during rotation and zoom", async () => {
  const source = await read("app/bag-builder-construction-pass.tsx");
  assert.match(source, /perspectiveSide/);
  assert.match(source, /Side gusset construction/);
  assert.match(source, /Bottom\/base seam/);
  assert.match(source, /Handle attachment tabs\/rings/);
  assert.match(source, /Strap anchors live on the side seam/);
  assert.match(source, /Flap edge piping/);
  assert.match(source, /pointermove/);
  assert.match(source, /pointersRef\.current\.size >= 2/);
  assert.match(source, /viewRef\.current\.zoom/);
});

test("construction overlay remains available as a non-interactive calibration fallback", async () => {
  const css = await read("app/bag-builder-construction-pass.css");
  const layout = await read("app/layout.tsx");
  assert.match(layout, /bag-builder-construction-pass\.css/);
  assert.match(css, /pointer-events:none!important/);
  assert.match(css, /abags-pro3d-active/);
  assert.match(css, /abags-canvas3d-active/);
});
