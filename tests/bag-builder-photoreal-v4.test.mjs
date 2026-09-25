import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("photoreal V4 is retained as historical fallback and V23 owns the active mount", async () => {
  const layout = await read("app/layout.tsx");
  assert.doesNotMatch(layout, /<BagBuilderPhotorealV4 \/>/);
  assert.match(layout, /BagBuilderPhotorealV17Mount/);
});

test("photoreal V4 has explicit handle, strap, hardware and flap geometry", async () => {
  const renderer = await read("app/bag-builder-photoreal-v4.tsx");
  assert.match(renderer, /handle:mesh\(gl,tube/);
  assert.match(renderer, /strap:mesh\(gl,tube/);
  assert.match(renderer, /metal:mesh\(gl,torus/);
  assert.match(renderer, /flap:mesh\(gl,ellipsoid/);
  assert.match(renderer, /handles.*none\|brak/);
});

test("photoreal V4 keeps four stitch families and high-frequency yarn detail", async () => {
  const renderer = await read("app/bag-builder-photoreal-v4.tsx");
  assert.match(renderer, /includes\("herringbone"\)/);
  assert.match(renderer, /includes\("basket"\)/);
  assert.match(renderer, /includes\("shell"\)/);
  assert.match(renderer, /noise\(vUv\*760\.\)/);
  assert.match(renderer, /stitch\(aUv,uStitch\)\*\.032/);
});
