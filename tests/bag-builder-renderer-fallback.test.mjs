import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const stack = fs.readFileSync("app/exact-live-customizer.tsx", "utf8");
const fallback = fs.readFileSync("app/bag-builder-renderer-fallback.tsx", "utf8");
const canvas = fs.readFileSync("app/bag-builder-canvas3d.tsx", "utf8");

test("Fidelity3D remains primary while software 3D is mounted only as fallback infrastructure", () => {
  const fidelityIndex = stack.indexOf("<BagBuilderFidelity3D />");
  const fallbackIndex = stack.indexOf("<BagBuilderRendererFallback />");
  assert.ok(fidelityIndex > -1);
  assert.ok(fallbackIndex > fidelityIndex);
  assert.match(fallback, /<BagBuilderCanvas3D \/>/);
  assert.match(fallback, /<BagBuilderCanvas3DTouchRescue \/>/);
});

test("software renderer activates only when WebGL readiness is absent", () => {
  assert.match(canvas, /data-abags-pro3d-ready/);
  assert.match(canvas, /window\.setTimeout\(\(\) =>/);
  assert.match(canvas, /setEnabled\(true\)/);
  assert.match(canvas, /data-abags-canvas3d-ready/);
  assert.match(canvas, /setEnabled\(false\)/);
});

test("reference layout cannot display WebGL and canvas fallback at the same time", () => {
  assert.match(fallback, /abags-canvas3d-active:not\(\.abags-pro3d-active\) > \.abags-canvas3d-layer/);
  assert.match(fallback, /abags-pro3d-active > \.abags-canvas3d-layer/);
  assert.match(fallback, /display: none !important/);
  assert.match(fallback, /visibility: hidden !important/);
  assert.match(fallback, /pointer-events: none !important/);
});

test("canvas fallback remains touch-interactive on narrow mobile screens", () => {
  assert.match(fallback, /@media \(max-width: 820px\)/);
  assert.match(fallback, /touch-action: none !important/);
  assert.match(fallback, /\.abags-canvas3d-views/);
  assert.match(fallback, /\.abags-canvas3d-zoom/);
  assert.match(fallback, /grid-template-columns: 36px minmax\(92px, 1fr\) 36px 48px/);
});
