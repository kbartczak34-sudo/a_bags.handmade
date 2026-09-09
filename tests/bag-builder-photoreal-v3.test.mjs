import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("photoreal V3 is mounted after V2 as the authoritative visual layer", async () => {
  const layout = await read("app/layout.tsx");
  const renderer = await read("app/bag-builder-photoreal-v3.tsx");
  assert.match(layout, /import BagBuilderPhotorealV3 from ".\\/bag-builder-photoreal-v3"/);
  assert.match(layout, /<BagBuilderPhotorealV2 \/>[\s\S]*<BagBuilderPhotorealV3 \/>/);
  assert.match(renderer, /abags-photoreal-v3-canvas/);
  assert.match(renderer, /zIndex:\"20\"/);
  assert.match(renderer, /getContext\(\"webgl\"/);
});

test("photoreal V3 maps all stitch choices and keeps hardware/accent visible", async () => {
  const renderer = await read("app/bag-builder-photoreal-v3.tsx");
  assert.match(renderer, /s===\"herringbone\"\?1/);
  assert.match(renderer, /s===\"basket\"\?2/);
  assert.match(renderer, /s===\"shell\"\?3:0/);
  assert.match(renderer, /c\.hardware/);
  assert.match(renderer, /c\.accent/);
  assert.match(renderer, /ms\.metal/);
  assert.match(renderer, /ms\.accent/);
});

test("photoreal V3 uses a wider mobile camera envelope and complete handle framing", async () => {
  const renderer = await read("app/bag-builder-photoreal-v3.tsx");
  assert.match(renderer, /T\(0,-\.08,-4\.9\)/);
  assert.match(renderer, /MM\(\[0,\.93,0\]/);
});
