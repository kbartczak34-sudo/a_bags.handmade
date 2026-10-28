import assert from "node:assert/strict";
import test from "node:test";
import { Matrix4, Triangle, Vector3 } from "three";
import { geometry as g } from "./helpers/fidelity-geometry.mjs";

test("rose and pastel photographs select flat bases while the navy retains a round ring", () => {
  const config = { family: "tall-tote", color: "#D58FAA", handles: "wood-dark" };
  assert.equal(g.getAbagsWoodHandleShape(config), "flat-base");
  assert.equal(g.getAbagsWoodHandleShape({ ...config, handles: "wood-light" }), "flat-base");
  assert.equal(g.getAbagsWoodHandleShape({ ...config, color: "#BA9ECF", handles: "wood-light" }), "flat-base");
  assert.equal(g.getAbagsWoodHandleShape({ ...config, family: "mini", color: "#BA9ECF" }), "round");
  for (const color of ["#24324D", "#0E9AA7", "#88583F", "#123456"])
    assert.equal(g.getAbagsWoodHandleShape({ ...config, color }), "round");
  assert.equal(g.getAbagsWoodHandleShape({ ...config, handles: "crochet" }), "round");
});

test("the D-shaped handle has a straight rail, rounded corners and the same open wooden arch", () => {
  let straightSamples = 0;
  for (let i = 0; i <= 320; i++) {
    const angle = i / 320 * Math.PI * 2;
    const frame = g.referenceWoodHandleFrame(angle, "flat-base");
    const round = g.referenceWoodHandleFrame(angle, "round");
    assert.ok([...frame.center, ...frame.outward, ...frame.tangent].every(Number.isFinite));
    if (angle <= Math.PI) assert.deepEqual(frame, round);
    else {
      assert.ok(frame.center[1] >= -.140001);
      if (Math.abs(frame.center[0]) < .33) {
        straightSamples++;
        assert.ok(Math.abs(frame.center[1] + .14) < 1e-7);
        assert.ok(Math.abs(frame.outward[1] + 1) < 1e-7);
      }
    }
  }
  assert.ok(straightSamples > 80);
  const wood = g.makeReferenceWoodHandle("flat-base");
  const vertices = wood.positions.length / 3;
  assert.ok(vertices < 65536 && wood.positions.every(Number.isFinite));
  assert.ok(wood.indices.every(i => i >= 0 && i < vertices));
  for (let i = 0; i < wood.normals.length; i += 3)
    assert.ok(Math.abs(Math.hypot(...wood.normals.slice(i, i + 3)) - 1) < 1e-5);
});

test("the rose binding surrounds the actual wood and remains mirrored through the bag depth", () => {
  const family = "tall-tote", [backZ, frontZ] = g.woodHandleDepthPlanes(family);
  const front = g.woodHandleBindingPaths(family, frontZ, "flat-base");
  const back = g.woodHandleBindingPaths(family, backZ, "flat-base");
  const wood = g.makeReferenceWoodHandle("flat-base");
  const pose = new Matrix4().fromArray(g.woodHandleMatrix(family, frontZ));
  const vertex = i => new Vector3().fromArray(wood.positions, i * 3).applyMatrix4(pose);
  const triangles = [];
  for (let i = 0; i < wood.indices.length; i += 3)
    triangles.push(new Triangle(...wood.indices.slice(i, i + 3).map(vertex)));
  const point = new Vector3(), nearest = new Vector3();
  for (let i = 0; i < front.winding.length; i++) {
    const a = front.winding[i], b = back.winding[i];
    assert.ok(Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7 && Math.abs(a[2] + b[2]) < 1e-7);
    if (i % 10) continue;
    point.fromArray(a);
    let distance = Infinity;
    for (const triangle of triangles) {
      triangle.closestPointToPoint(point, nearest);
      distance = Math.min(distance, point.distanceTo(nearest));
    }
    assert.ok(distance >= front.radius + .0002, `cord intersects wood: ${distance}`);
    assert.ok(distance < front.radius * 1.7 + .004, `cord floats away: ${distance}`);
  }
  const binding = g.makeWoodHandleBinding(family, "flat-base");
  assert.ok(binding.positions.length / 3 < 65536);
  assert.ok(binding.positions.every(Number.isFinite));
  for (let i = 0; i < binding.normals.length; i += 3)
    assert.ok(Math.abs(Math.hypot(...binding.normals.slice(i, i + 3)) - 1) < 1e-5);
});

test("switching handle shapes replaces GPU buffers while recoloring reuses them", () => {
  let allocated = 0, deleted = 0;
  const renderer = { meshes: {}, gl: {
    ARRAY_BUFFER: 1, ELEMENT_ARRAY_BUFFER: 2, STATIC_DRAW: 3,
    createBuffer() { allocated++; return {}; },
    bindBuffer() {}, bufferData() {}, deleteBuffer() { deleted++; },
  } };
  const ensure = shape => {
    g.ensureReferenceWoodHandle(renderer, shape);
    g.ensureWoodHandleBinding(renderer, "tall-tote", shape);
  };
  ensure("round");
  assert.equal(allocated, 8);
  ensure("round");
  assert.equal(allocated, 8);
  ensure("flat-base");
  assert.equal(allocated, 16);
  assert.equal(deleted, 8);
  ensure("round");
  assert.equal(allocated, 24);
  assert.equal(deleted, 16);
});
