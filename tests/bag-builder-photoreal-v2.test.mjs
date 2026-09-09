import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("photoreal V2 renderer is mounted as the final layout-level visual controller", async () => {
  const layout = await read("app/layout.tsx");
  const renderer = await read("app/bag-builder-photoreal-v2.tsx");
  assert.match(layout, /import BagBuilderPhotorealV2 from \"\.\/bag-builder-photoreal-v2\"/);
  assert.match(layout, /<BagBuilder3DEnhancer \/>[\s\S]*<BagBuilderPhotorealV2 \/>/);
  assert.match(renderer, /getContext\(\"webgl\"/);
  assert.match(renderer, /uStitch/);
  assert.match(renderer, /uMaterial/);
  assert.match(renderer, /uRough/);
  assert.match(renderer, /precision mediump float/);
});

test("photoreal renderer contains all four supported bag families", async () => {
  const renderer = await read("app/bag-builder-photoreal-v2.tsx");
  for (const family of ["tote", "round", "bucket", "mini"]) {
    assert.match(renderer, new RegExp(`\\b${family}:mesh`));
  }
  assert.match(renderer, /function shell/);
  assert.match(renderer, /function tube/);
  assert.match(renderer, /function ell/);
});

test("photoreal renderer keeps material separation for crochet and rigid components", async () => {
  const renderer = await read("app/bag-builder-photoreal-v2.tsx");
  assert.match(renderer, /uMaterial<\.5/);
  assert.match(renderer, /uMaterial<1\.5/);
  assert.match(renderer, /uMaterial<2\.5/);
  assert.match(renderer, /uMaterial>2\.5/);
  assert.match(renderer, /noise\(vUv\*680\.0\)/);
});
