import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [renderer, layout] = await Promise.all([
  readFile(new URL("../app/bag-builder-fidelity3d.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-reference-v4.tsx", import.meta.url), "utf8"),
]);

test("canonical Fidelity3D canvas remains interactive after final promotion", () => {
  assert.match(renderer, /style=\{\{ touchAction: "none", userSelect: "none", WebkitUserSelect: "none" \}\}/);
  assert.match(renderer, /onPointerDown=\{\(event\) =>/);
  assert.match(renderer, /setPointerCapture/);
  assert.match(renderer, /pointers\.current\.size >= 2/);
  assert.match(renderer, /onWheel=\{\(event\) =>/);
  assert.match(renderer, /setZoom\(clamp/);
});

test("V4 compositor does not disable input on the verified 3D canvas", () => {
  const readyBlock = layout.match(/\.abags-bag-builder-stage\[data-abags-live-stage="true"\]\[data-abags-final3d="ready"\] > \.abags-fidelity3d-layer > \.abags-fidelity3d-canvas \{[^}]+\}/)?.[0] ?? "";
  assert.match(readyBlock, /pointer-events: auto !important/);
  assert.match(readyBlock, /touch-action: none !important/);
  assert.doesNotMatch(readyBlock, /pointer-events: none !important/);
});

test("visible zoom controls are available to the customer", () => {
  const zoomBlock = layout.match(/\.abags-reference-layout-v4 \.abags-pro3d-zoom \{[^}]+\}/)?.[0] ?? "";
  assert.match(zoomBlock, /opacity: 1 !important/);
  assert.match(zoomBlock, /pointer-events: auto !important/);
});

test("mobile builder options have a coordinate-based touch rescue when hit testing lands on a section", () => {
  assert.match(layout, /const onPointerDown = \(event: PointerEvent\)/);
  assert.match(layout, /event\.pointerType !== "touch"/);
  assert.match(layout, /const onTouchEnd = \(event: TouchEvent\)/);
  assert.match(layout, /getBoundingClientRect\(\)/);
  assert.match(layout, /button\.click\(\)/);
  assert.match(layout, /touchend/);
});
