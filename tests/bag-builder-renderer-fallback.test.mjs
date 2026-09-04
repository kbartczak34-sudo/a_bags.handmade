import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const stack = fs.readFileSync("app/exact-live-customizer.tsx", "utf8");
const fallback = fs.readFileSync("app/bag-builder-renderer-fallback.tsx", "utf8");
const canvas = fs.readFileSync("app/bag-builder-premium-canvas3d.tsx", "utf8");

test("FinalWebGL3D remains primary while premium software 3D is mounted as fallback infrastructure", () => {
  const primaryIndex = stack.indexOf("<BagBuilderFinalWebGL3D />");
  const fallbackIndex = stack.indexOf("<BagBuilderRendererFallback />");
  assert.ok(primaryIndex > -1);
  assert.ok(fallbackIndex > primaryIndex);
  assert.ok(stack.indexOf("<BagBuilderFidelity3D />") === -1);
  assert.match(fallback, /<BagBuilderPremiumCanvas3D \/>/);
  assert.match(fallback, /<BagBuilderCanvas3DTouchRescue \/>/);
});

test("premium software renderer activates only when WebGL readiness is absent", () => {
  assert.match(canvas, /data-abags-pro3d-ready/);
  assert.match(canvas, /window\.setTimeout\(\(\) =>/);
  assert.match(canvas, /setEnabled\(true\)/);
  assert.match(canvas, /data-abags-canvas3d-ready/);
  assert.match(canvas, /premium-v2/);
  assert.match(canvas, /setEnabled\(false\)/);
});

test("reference layout cannot display WebGL and premium canvas fallback at the same time", () => {
  assert.match(fallback, /abags-canvas3d-active:not\(\.abags-pro3d-active\) > \.abags-canvas3d-layer/);
  assert.match(fallback, /abags-pro3d-active > \.abags-canvas3d-layer/);
  assert.match(fallback, /display: none !important/);
  assert.match(fallback, /visibility: hidden !important/);
  assert.match(fallback, /pointer-events: none !important/);
});

test("premium canvas fallback remains touch-interactive on narrow mobile screens", () => {
  assert.match(fallback, /@media \(max-width: 820px\)/);
  assert.match(fallback, /touch-action: none !important/);
  assert.match(fallback, /\.abags-canvas3d-views/);
  assert.match(fallback, /\.abags-canvas3d-zoom/);
  assert.match(fallback, /grid-template-columns: 36px minmax\(92px, 1fr\) 36px 48px/);
  assert.match(canvas, /onPointerMove/);
  assert.match(canvas, /pinch/);
});
