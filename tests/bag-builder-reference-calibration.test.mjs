import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("real reference calibration is loaded after construction and material layers", async () => {
  const layout = await read("app/layout.tsx");
  assert.match(layout, /bag-builder-reference-calibration\.css/);
  assert.ok(layout.indexOf("bag-builder-reference-calibration.css") > layout.indexOf("bag-builder-construction-pass.css"));
});

test("each configurable family has its own silhouette calibration", async () => {
  const css = await read("app/bag-builder-reference-calibration.css");
  for (const family of ["tote", "round", "bucket", "mini"]) {
    assert.match(css, new RegExp(`data-family=\\"${family}\\"`));
  }
  assert.match(css, /--abags-shape-x/);
  assert.match(css, /--abags-shape-y/);
  assert.match(css, /--abags-shape-shift-y/);
});

test("WebGL fallback and synchronized passes receive identical reference scaling", async () => {
  const css = await read("app/bag-builder-reference-calibration.css");
  assert.match(css, /abags-pro3d-canvas/);
  assert.match(css, /abags-canvas3d-canvas/);
  assert.match(css, /abags-material-pass-canvas/);
  assert.match(css, /abags-construction-pass-canvas/);
  assert.match(css, /scaleX\(var\(--abags-shape-x\)\)/);
  assert.match(css, /scaleY\(var\(--abags-shape-y\)\)/);
});
