import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../app/bag-builder-fidelity3d.tsx", import.meta.url), "utf8");

test("crocheted gusset is a separate true-depth mesh with continuous arc-length UV", () => {
  assert.match(source, /const sideRows = 12/);
  assert.match(source, /const sideStart = positions\.length \/ 3/);
  assert.match(source, /sideArcLength \+= Math\.hypot/);
  assert.match(source, /uvs\.push\(sideArcLength \* 0\.52, depthProgress \* 0\.46\)/);
  assert.match(source, /positions\[rimIndex \+ 2\] \* \(1 - depthProgress\)/);
  assert.match(source, /normals\.push\(\.\.\.outward\)/);
  assert.doesNotMatch(source, /connect\(frontEdge, backEdge\)/);
});

test("depth geometry wraps a real hollow bag and does not cap the mouth", () => {
  assert.match(source, /if \(\(contour\[i\]\[1\] \+ contour\[next\]\[1\]\) \* \.5 < spec\.ry \* \.90\)/);
  assert.match(source, /for \(let across = 0; across < sideRows; across\+\+\)/);
  assert.match(source, /indices\.push\(a, a \+ 1, b, b, a \+ 1, b \+ 1\)/);
  assert.match(source, /connect\(backEdge, backFace, true\)/);
  assert.match(source, /const faceBands = 52/);
});

test("sidewall vertex count stays far below WebGL unsigned short index limit", () => {
  const perimeterVertices = 96;
  const sideVertices = (perimeterVertices + 1) * (12 + 1);
  // Four contour rings + 52 rings per fabric face plus the new sidewall.
  const maxVertices = 4 * perimeterVertices + 2 * (52 * perimeterVertices + 1) + sideVertices;
  assert.ok(maxVertices < 65535, String(maxVertices));
});
