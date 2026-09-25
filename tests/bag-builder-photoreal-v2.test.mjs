import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("photoreal V2 is retained as historical fallback and is not mounted as the authoritative renderer", async () => {
  const layout = await read("app/layout.tsx");
  const renderer = await read("app/bag-builder-photoreal-v2.tsx");
  assert.doesNotMatch(layout, /<BagBuilderPhotorealV2 \/>/);
  assert.match(layout, /BagBuilderPhotorealV17Mount/);
  assert.match(renderer, /getContext\("webgl"/);
});

test("photoreal renderer contains all four supported bag families", async () => {
  const renderer = await read("app/bag-builder-photoreal-v2.tsx");
  for (const family of ["tote", "round", "bucket", "mini"]) {
    assert.match(renderer, new RegExp(`\\b${family}:geometry`));
  }
  assert.match(renderer, /function shell/);
  assert.match(renderer, /function tube/);
  assert.match(renderer, /function ell/);
});

test("photoreal renderer keeps material separation for crochet and rigid components", async () => {
  const renderer = await read("app/bag-builder-photoreal-v2.tsx");
  assert.match(renderer, /uMaterial<\.5/);
  assert.match(renderer, /uMaterial<1\.5/);
  assert.match(renderer, /step\(2\.5,uMaterial\)/);
  assert.match(renderer, /uMaterial>2\.5/);
  assert.match(renderer, /noise\(vUv\*620\.\)/);
});
