import assert from "node:assert/strict";
import test from "node:test";
import { Matrix4, Triangle, Vector3 } from "three";
import { geometry as g } from "./helpers/fidelity-geometry.mjs";

test("cord winding clears the actual flat wooden handle at every sampled phase", () => {
  const family = "tall-tote", plane = g.woodHandleDepthPlanes(family)[1];
  const data = g.woodHandleBindingPaths(family, plane);
  const wood = g.makeReferenceWoodHandle(), pose = new Matrix4().fromArray(g.woodHandleMatrix(family, plane));
  const vertex = index => new Vector3().fromArray(wood.positions, index * 3).applyMatrix4(pose);
  const triangles = [];
  for (let i = 0; i < wood.indices.length; i += 3) {
    triangles.push(new Triangle(...wood.indices.slice(i, i + 3).map(vertex)));
  }
  const p = new Vector3(), nearest = new Vector3(), distances = [];
  const step = Math.max(1, Math.floor(data.winding.length / 280));
  for (let i = 0; i < data.winding.length; i += step) {
    p.fromArray(data.winding[i]);
    let distance2 = Infinity;
    for (const triangle of triangles) {
      triangle.closestPointToPoint(p, nearest);
      distance2 = Math.min(distance2, nearest.distanceToSquared(p));
    }
    distances.push(Math.sqrt(distance2));
  }
  assert.ok(Math.min(...distances) >= data.radius + .0002,
    `cord radius ${data.radius}; minimum wood clearance ${Math.min(...distances)}`);
  assert.ok(Math.max(...distances) < data.radius * 1.7 + .004,
    "the binding must remain seated around the handle");
});

test("flat-handle winding remains mirrored, tightly spaced and portable in WebGL 1", () => {
  const family = "tall-tote", [rearZ, frontZ] = g.woodHandleDepthPlanes(family);
  const front = g.woodHandleBindingPaths(family, frontZ), rear = g.woodHandleBindingPaths(family, rearZ);
  assert.equal(front.winding.length, rear.winding.length);
  for (let i = 0; i < front.winding.length; i++) {
    const a = front.winding[i], b = rear.winding[i];
    assert.ok(Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7 && Math.abs(a[2] + b[2]) < 1e-7);
    if (i) assert.ok(Math.hypot(...a.map((n,j)=>n-front.winding[i-1][j])) < front.radius * 1.1);
  }
  const mesh = g.makeWoodHandleBinding(family), count = mesh.positions.length / 3;
  assert.ok(count < 65536);
  assert.ok(mesh.positions.every(Number.isFinite));
  assert.ok(mesh.indices.every(i => i >= 0 && i < count));
  for (let i = 0; i < mesh.normals.length; i += 3) {
    assert.ok(Math.abs(Math.hypot(...mesh.normals.slice(i,i+3)) - 1) < 1e-5);
  }
});
