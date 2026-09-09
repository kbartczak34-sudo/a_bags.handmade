import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("photoreal V4 is mounted after V3 as the authoritative mobile visual layer", async () => {
  const layout = await read("app/layout.tsx");
  const renderer = await read("app/bag-builder-photoreal-v4.tsx");
  assert.ok(layout.indexOf('import BagBuilderPhotorealV3 from "./bag-builder-photoreal-v3"') < layout.indexOf('import BagBuilderPhotorealV4 from "./bag-builder-photoreal-v4"'));
  assert.ok(layout.indexOf("<BagBuilderPhotorealV3 />") < layout.indexOf("<BagBuilderPhotorealV4 />"));
  assert.match(renderer, /abags-photoreal-v4-canvas/);
  assert.match(renderer, /zIndex:"40"/);
  assert.match(renderer, /getContext\("webgl"/);
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
