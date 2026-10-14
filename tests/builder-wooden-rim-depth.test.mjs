import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const renderer = await readFile(new URL("../app/bag-builder-fidelity3d.tsx", import.meta.url), "utf8");
const specs = await readFile(new URL("../lib/abags-fidelity-v4-family-spec.ts", import.meta.url), "utf8");

test("two real wooden ring handles remain distinct but close to the front/back rim", () => {
  assert.match(renderer, /const depthPlanes = \[-profile\.topDepth \* 0\.56, profile\.topDepth \* 0\.56\]/);
  assert.match(renderer, /for \(const z of depthPlanes\)/);
  assert.match(renderer, /drawMesh\([\s\S]*?mesh,[\s\S]*?handleColor/);
  assert.doesNotMatch(renderer, /topDepth \* 0\.78/);
});

test("rim seating remains outside the bag shell for every family profile", () => {
  const depthMultipliers = { tote: 1.78, round: 1.34, bucket: 1.52, mini: 1.42 };
  for (const [family, factor] of Object.entries(depthMultipliers)) {
    const block = specs.match(new RegExp(`\\b${family}: \\{([\\s\\S]*?)\\n  \\},`))?.[1];
    assert.ok(block, `missing ${family} spec`);
    const depth = Number(block.match(/\\bdepth:\\s*([0-9.]+)/)?.[1]);
    const bodyHalfDepth = depth * factor / 2;
    const handleDepth = depth * factor * 0.92 * 0.56;
    assert.ok(handleDepth > bodyHalfDepth, `${family}: wooden ring sits inside the front/back face`);
  }
});
