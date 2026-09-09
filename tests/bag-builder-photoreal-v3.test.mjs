import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("photoreal V3 is mounted after V2 as the authoritative visual layer", async () => {
  const layout = await read("app/layout.tsx");
  const renderer = await read("app/bag-builder-photoreal-v3.tsx");
  assert.ok(layout.includes('import BagBuilderPhotorealV3 from "./bag-builder-photoreal-v3"'));
  assert.ok(layout.indexOf("<BagBuilderPhotorealV2 />") < layout.indexOf("<BagBuilderPhotorealV3 />"));
  assert.ok(renderer.includes("abags-photoreal-v3-canvas"));
  assert.ok(renderer.includes("zIndex:\"20\""));
  assert.ok(renderer.includes('getContext("webgl"'));
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
