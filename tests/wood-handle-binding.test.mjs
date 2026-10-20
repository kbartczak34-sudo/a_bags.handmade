import assert from "node:assert/strict";
import test from "node:test";
import { geometry, specs } from "./helpers/fidelity-geometry.mjs";

const families = ["tote", "mini"];

function localPoint(model, point) {
  const delta = point.map((value, axis) => value - model[12 + axis]);
  return [0, 4, 8].map((column) =>
    (delta[0] * model[column] + delta[1] * model[column + 1] + delta[2] * model[column + 2])
    / (model[column] ** 2 + model[column + 1] ** 2 + model[column + 2] ** 2));
}

test("binding winds around the physical lower wood ring, with a mirrored seam at the back", () => {
  for (const family of families) {
    const [rearZ, frontZ] = geometry.woodHandleDepthPlanes(family);
    const front = geometry.woodHandleBindingPaths(family, frontZ);
    const rear = geometry.woodHandleBindingPaths(family, rearZ);
    const model = geometry.woodHandleMatrix(family, frontZ);
    assert.ok(front.seams.length >= 18);
    for (let i = 0; i < front.winding.length; i++) {
      const a = front.winding[i], b = rear.winding[i];
      assert.ok(Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7);
      assert.ok(Math.abs(a[2] + b[2]) < 1e-7);
      const point = localPoint(model, a);
      const angle = Math.atan2(point[1] / .42, point[0] / .46);
      const separation = Math.hypot(point[0] - .46 * Math.cos(angle), point[1] - .42 * Math.sin(angle), point[2]);
      assert.ok(separation > .045 && separation < .075, `${family}: coil stays around the wood`);
      assert.ok(point[1] < .03, `${family}: the grip above the textile remains bare wood`);
    }
  }
});

test("every sewn attachment reaches the visible crocheted body rather than a detached projection", () => {
  for (const family of families) {
    const plane = geometry.woodHandleDepthPlanes(family)[1];
    const { seams, radius } = geometry.woodHandleBindingPaths(family, plane);
    for (const stitch of ["classic", "herringbone", "basket", "shell"]) {
      const panel = geometry.makeCrochetPanel(family, stitch);
      for (const seam of seams) {
        const point = seam[0];
        let nearest = Infinity;
        for (let i = 0; i < panel.positions.length; i += 3) {
          nearest = Math.min(nearest, Math.hypot(point[0] - panel.positions[i], point[1] - specs[family].bodyY - panel.positions[i + 1], point[2] - panel.positions[i + 2]));
        }
        assert.ok(nearest < radius * 2.5, `${family}/${stitch}: sewn contact ${nearest}`);
      }
    }
  }
});

test("the binding has valid WebGL 1 geometry and unit yarn normals", () => {
  for (const family of families) {
    const mesh = geometry.makeWoodHandleBinding(family);
    const vertices = mesh.positions.length / 3;
    assert.ok(vertices > 2000 && vertices < 65536);
    assert.equal(mesh.normals.length, mesh.positions.length);
    assert.equal(mesh.uvs.length, vertices * 2);
    assert.ok(mesh.positions.every(Number.isFinite));
    assert.ok(mesh.indices.every((index) => Number.isInteger(index) && index >= 0 && index < vertices));
    for (let i = 0; i < mesh.normals.length; i += 3) {
      assert.ok(Math.abs(Math.hypot(...mesh.normals.slice(i, i + 3)) - 1) < 1e-5);
    }
  }
});

test("rotation, recoloring and stitch changes reuse binding buffers; changing the family frees them", () => {
  let allocated = 0, deleted = 0;
  const renderer = { meshes: {}, gl: {
    ARRAY_BUFFER: 1, ELEMENT_ARRAY_BUFFER: 2, STATIC_DRAW: 3,
    createBuffer() { allocated++; return {}; },
    bindBuffer() {}, bufferData() {}, deleteBuffer() { deleted++; },
  } };
  geometry.ensureWoodHandleBinding(renderer, "tote");
  assert.equal(allocated, 4);
  geometry.ensureWoodHandleBinding(renderer, "tote");
  assert.equal(allocated, 4);
  geometry.ensureWoodHandleBinding(renderer, "mini");
  assert.equal(allocated, 8);
  assert.equal(deleted, 4);
  assert.equal(Object.keys(renderer.meshes).length, 1);
});
