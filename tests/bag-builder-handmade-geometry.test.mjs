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
  assert.match(renderer, /bottomY: spec\.bodyY - spec\.ry \* \.72/);
  assert.match(renderer, /agataOpenWoodTote \? 5 : 11/);
  assert.match(renderer, /uMaterial<5\.5/);
  assert.match(renderer, /const points = openingPath\(family\)/);
});
test("the visible body uses actual 5 mm cylindrical yarn instead of embossed grid shading", () => {
  assert.match(renderer, /const radius = spec\.rx \* 5 \/ 160/);
  assert.match(renderer, /ensureCrochetMeshes\(renderer, renderFamily/);
  for (const panel of ["yarnFront", "yarnBack", "yarnSide"]) {
    assert.ok(renderer.includes(`drawMesh(renderer, meshes.${panel}, bodyModel, body, 7`));
  }
});
