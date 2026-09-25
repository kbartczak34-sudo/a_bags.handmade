import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("photoreal V3 is retained as historical fallback and V23 owns the active mount", async () => {
  const layout = await read("app/layout.tsx");
  assert.doesNotMatch(layout, /<BagBuilderPhotorealV3 \/>/);
  assert.match(layout, /BagBuilderPhotorealV17Mount/);
});

test("photoreal V3 maps all stitch choices and keeps hardware/accent visible", async () => {
  const renderer = await read("app/bag-builder-photoreal-v3.tsx");
  assert.ok(renderer.includes('s==="herringbone"?1'));
  assert.ok(renderer.includes('s==="basket"?2'));
  assert.ok(renderer.includes('s==="shell"?3:0'));
  assert.ok(renderer.includes("c.hardware"));
  assert.ok(renderer.includes("c.accent"));
  assert.ok(renderer.includes("ms.metal"));
  assert.ok(renderer.includes("ms.accent"));
});

test("photoreal V3 uses a wider mobile camera envelope and complete handle framing", async () => {
  const renderer = await read("app/bag-builder-photoreal-v3.tsx");
  assert.ok(renderer.includes("T(0,-.08,-4.9)"));
  assert.ok(renderer.includes("MM([0,.93,0]"));
});
