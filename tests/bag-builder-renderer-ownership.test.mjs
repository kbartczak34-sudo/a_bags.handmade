import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [layout, stack, fallback, promotion] = await Promise.all([
  readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-premium-canvas3d.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-final3d-promotion.css", import.meta.url), "utf8"),
]);

test("storefront mounts a single customer 3D renderer and avoids the global V23 overlay", () => {
  assert.match(layout, /<ExactLiveCustomizer \/>/);
  assert.doesNotMatch(layout, /BagBuilderPhotorealV17Mount|<BagBuilderPhotorealV23 \/>/);
  assert.match(stack, /<BagBuilderFidelity3D \/>/);
  assert.match(stack, /<BagBuilderFinal3DController \/>/);
  assert.match(stack, /<BagBuilderRendererFallback \/>/);
});

test("software fallback cannot replace the neutral empty construction with a blank frame", () => {
  assert.match(fallback, /if \(!stage\.dataset\.family\) \{/);
  assert.match(fallback, /attributeFilter: \["data-abags-pro3d-ready", "data-abags-final3d", "data-family"\]/);
  assert.match(fallback, /if \(!config\.family\) return false;/);
});

test("software fallback is promoted only after a successfully painted canvas", () => {
  const start = fallback.indexOf("const paint = () => {");
  const end = fallback.indexOf("let frame = requestAnimationFrame(paint)", start);
  const paint = fallback.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(paint, /drawPremium\(canvas, config, rotation, zoom, sprite\)/);
  assert.match(paint, /if \(!painted \|\| canvas\.width < 16 \|\| canvas\.height < 16\)/);
  assert.ok(paint.indexOf("drawPremium(") < paint.indexOf('stage.classList.add("abags-canvas3d-active"'));
  assert.match(paint, /stage\.removeAttribute\("data-abags-canvas3d-ready"\)/);
});

test("verified software preview replaces SVG and provisional WebGL without covering their controls", () => {
  assert.match(promotion, /\.abags-bag-builder-stage > \.abags-premium-canvas3d-layer \{/);
  assert.match(promotion, /\.abags-bag-builder-stage\.abags-premium-canvas3d-active:not\(\[data-abags-final3d="ready"\]\) > \.abags-premium-canvas3d-layer/);
  assert.match(promotion, /z-index:300!important;/);
  assert.match(promotion, /> svg,[\s\S]*?> \.abags-fidelity3d-layer \{[\s\S]*?display:none!important;/);
});
