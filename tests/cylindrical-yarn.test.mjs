import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { geometry, specs } from "./helpers/fidelity-geometry.mjs";

function checkMesh(mesh, label) {
  const vertices = mesh.positions.length / 3;
  assert.ok(vertices > 100 && vertices <= 65535, `${label}: ${vertices} vertices`);
  assert.equal(mesh.normals.length, mesh.positions.length);
  assert.equal(mesh.uvs.length, vertices * 2);
  assert.ok(mesh.positions.every(Number.isFinite), `${label}: finite positions`);
  assert.ok(mesh.indices.length > 300);
  for (const index of mesh.indices) assert.ok(Number.isInteger(index) && index >= 0 && index < vertices, `${label}: valid WebGL index`);
  for (let i = 0; i < mesh.normals.length; i += 3) {
    const length = Math.hypot(...mesh.normals.slice(i, i + 3));
    assert.ok(Math.abs(length - 1) < .001, `${label}: unit surface normals`);
  }
  // Real tube normals point both into and out of the textile plane. A flat
  // image or an embossed colour-only shader cannot satisfy this condition.
  assert.ok(mesh.normals.some((v, i) => i % 3 === 2 && v > .8));
  assert.ok(mesh.normals.some((v, i) => i % 3 === 2 && v < -.8));
  return vertices;
}

test("every family and stitch produces finite cylindrical yarn within the Android WebGL index budget", () => {
  for (const family of Object.keys(specs)) {
    for (const stitch of ["classic", "herringbone", "basket", "shell"]) {
      checkMesh(geometry.makeCrochetPanel(family, stitch), `${family}/${stitch}`);
    }
    checkMesh(geometry.makeCrochetGusset(family), `${family}/gusset`);
  }
});

test("the opening meets both textile panels at their actual height", () => {
  for (const [family, spec] of Object.entries(specs)) {
    const path = geometry.openingPath(family);
    const half = path.length / 2;
    assert.ok(Math.abs(Math.max(...path.map((p) => p[1])) - (spec.bodyY + spec.ry)) < .001);
    for (let i = 0; i < half; i++) {
      const front = path[i], back = path[path.length - 1 - i];
      assert.equal(front[0], back[0]);
      assert.equal(front[1], back[1]);
      assert.equal(front[2], -back[2]);
    }
  }
});

test("wood and flap lighting normals stay perpendicular after unequal axis scaling and rotation", () => {
  const model = geometry.matrix([.1, .3, .5], [.4, 1.7, .8], [.3, -.7, .2]);
  const normal = geometry.normalMatrix(model);
  const tangent = [model[0], model[1], model[2]];
  const transformedNormal = [normal[3], normal[4], normal[5]];
  const dot = tangent.reduce((sum, v, i) => sum + v * transformedNormal[i], 0);
  assert.ok(Math.abs(dot) < 1e-6, String(dot));
});

test("rotation reuses yarn buffers and changing construction frees the previous GPU allocation", () => {
  let bound, allocated = 0, deleted = 0;
  const gl = {
    ARRAY_BUFFER: 1, ELEMENT_ARRAY_BUFFER: 2, STATIC_DRAW: 3,
    createBuffer() { allocated++; return {}; },
    bindBuffer(_target, buffer) { bound = buffer; },
    bufferData(_target, data) { bound.data = data; },
    deleteBuffer() { deleted++; },
  };
  const renderer = { gl, meshes: {} };
  geometry.ensureCrochetMeshes(renderer, "tote", "classic");
  const firstAllocation = allocated;
  geometry.ensureCrochetMeshes(renderer, "tote", "classic");
  assert.equal(allocated, firstAllocation);
  const front = renderer.meshes.yarnFront.position.data, back = renderer.meshes.yarnBack.position.data;
  for (let i = 0; i < front.length; i++) assert.equal(back[i], i % 3 === 2 ? -front[i] : front[i]);
  geometry.ensureCrochetMeshes(renderer, "round", "shell");
  assert.equal(deleted, firstAllocation);
  assert.equal(Object.keys(renderer.meshes).length, 3);
});

test("legacy texture canvases yield to the visible cylindrical yarn", async () => {
  for (const file of ["basket-weave-finish", "crochet-relief-overlay", "handmade-edge-finish", "opening-depth", "sidewall-crochet-depth", "lifelike-surface", "rigid-material-finish"]) {
    const pass = await readFile(new URL(`../app/bag-builder-${file}.tsx`, import.meta.url), "utf8");
    assert.ok(pass.includes('dataset.abagsCrochetOwner === "webgl-yarn"'), file);
  }
});
