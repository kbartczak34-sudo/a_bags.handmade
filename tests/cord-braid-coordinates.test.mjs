import assert from "node:assert/strict";
import test from "node:test";
import { geometry } from "./helpers/fidelity-geometry.mjs";

const sides = 10;
function cord(points, radius = .03, contains = () => true) {
  const mesh = { positions: [], normals: [], uvs: [], indices: [] };
  geometry.appendCord(mesh, points, radius, () => [0, 0, 1], contains, sides);
  return mesh;
}
const uAt = (mesh, ring) => mesh.uvs[ring * (sides + 1) * 2];

test("braid size is constant on a stitch and a longer binding at the same physical distance", () => {
  const loop = cord([[0, 0, 0], [.1, 0, 0], [.2, 0, 0]]);
  const binding = cord([[0, 0, 0], [.1, 0, 0], [.2, 0, 0], [.8, 0, 0]]);
  assert.equal(uAt(loop, 1), uAt(binding, 1));
  assert.equal(uAt(loop, 2), uAt(binding, 2));
  assert.ok(uAt(binding, 3) > uAt(loop, 2));
});

test("braid density survives nonuniform curve sampling and uniform product scaling", () => {
  const sparse = cord([[0, 0, 0], [.1, 0, 0], [.4, 0, 0]]);
  const dense = cord([[0, 0, 0], [.04, 0, 0], [.1, 0, 0], [.13, 0, 0], [.4, 0, 0]]);
  assert.ok(Math.abs(uAt(sparse, 1) - uAt(dense, 2)) < 1e-12);
  assert.ok(Math.abs(uAt(sparse, 2) - uAt(dense, 4)) < 1e-12);
  const scaled = cord([[0, 0, 0], [0, .2, 0], [0, .8, 0]], .06);
  assert.ok(Math.abs(uAt(sparse, 2) - uAt(scaled, 2)) < 1e-12);
});

test("clipping the cord at a fabric boundary does not restart or stretch its braid", () => {
  const points = [[0, 0, 0], [.1, 0, 0], [.2, 0, 0], [.3, 0, 0], [.4, 0, 0]];
  const full = cord(points);
  const clipped = cord(points, .03, ([x]) => x >= .2);
  for (let i = 0; i < 3; i++) assert.equal(uAt(clipped, i), uAt(full, i + 2));
  for (let i = 0; i < clipped.positions.length / 3; i += sides + 1) {
    const start = i * 3, end = (i + sides) * 3;
    for (let axis = 0; axis < 3; axis++) {
      assert.ok(Math.abs(clipped.positions[start + axis] - clipped.positions[end + axis]) < 1e-12);
    }
    assert.equal(clipped.uvs[i * 2 + 1], 0);
    assert.equal(clipped.uvs[(i + sides) * 2 + 1], 1);
  }
});
