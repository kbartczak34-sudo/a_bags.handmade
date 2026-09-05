import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const renderer = await readFile(new URL("../app/bag-builder-final-webgl3d.tsx", import.meta.url), "utf8");

test("rigid wooden handles occupy front and back body planes instead of the centre plane", () => {
  assert.ok(renderer.includes('const rigidHandle = config.handles === "wood-light" || config.handles === "wood-dark"'));
  assert.ok(renderer.includes("const handleDepth = depth / 2 + .055"));
  assert.ok(renderer.includes("const handlePlanes = rigidHandle ? [-handleDepth, handleDepth] : [.015]"));
  assert.ok(renderer.includes("for (const handleZ of handlePlanes)"));
  assert.ok(renderer.includes("matrix([0, topY - .01, handleZ]"));
  assert.equal(renderer.includes("matrix([0, topY - .01, .015], [metrics.handleScale[0], metrics.handleScale[1], 1])"), false);
});

test("side fidelity is fixed by handle geometry without weakening the camera or body contract", () => {
  assert.ok(renderer.includes('next === "side" ? { x: -.035, y: Math.PI / 2 }'));
  assert.ok(renderer.includes("drawMesh(renderer, meshes[config.family], root, bodyColor, stitch, 0)"));
  assert.ok(renderer.includes("const { depth, topY, side } = metrics"));
});
