import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const renderer = await readFile(new URL("../app/bag-builder-fidelity3d.tsx", import.meta.url), "utf8");

test("the active customer renderer tessellates both crochet panels rather than a flat triangle fan", () => {
  assert.match(renderer, /const faceBands = 52/);
  assert.match(renderer, /addFabricFace\(frontFace, 1\)/);
  assert.match(renderer, /addFabricFace\(backFace, -1\)/);
});
test("the bag has an open mouth and actual matte fabric interior", () => {
  assert.match(renderer, /spec\.ry \* \.90/);
  assert.match(renderer, /const bottomY = topY - Math\.min\(\.43/);
  assert.match(renderer, /agataOpenWoodTote \? 5 : 6/);
  assert.match(renderer, /uMaterial<5\.5/);
  assert.match(renderer, /depthAt\(family, spec\.topY\) \* 0\.94/);
});
test("crochet relief and yarn shader are aligned at a realistic loop density", () => {
  assert.match(renderer, /uv\.x\*28\.0\+stagger/);
  assert.match(renderer, /uv\.x\*28\.0\+floor\(uv\.y\*26\.0\)/);
  assert.match(renderer, /const relief = config\.color && config\.stitch \? 0\.037/);
});
