import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { geometry, specs } from "./helpers/fidelity-geometry.mjs";

const stitches = ["classic", "herringbone", "basket", "shell"];
const hash = (mesh) => createHash("sha256").update(JSON.stringify(mesh.positions)).digest("hex");

test("each selected stitch has distinct real geometry on both the flap and the gusset", () => {
  for (const family of Object.keys(specs)) {
    for (const make of [geometry.makeCrochetFlap, geometry.makeCrochetGusset]) {
      const signatures = new Set();
      for (const stitch of stitches) {
        const mesh = make(family, stitch);
        const vertices = mesh.positions.length / 3;
        assert.ok(vertices > 100 && vertices < 65536, `${family}/${stitch}: WebGL 1 index budget`);
        assert.ok(mesh.positions.every(Number.isFinite));
        assert.equal(mesh.normals.length, mesh.positions.length);
        assert.equal(mesh.uvs.length, vertices * 2);
        assert.ok(mesh.indices.every((i) => Number.isInteger(i) && i >= 0 && i < vertices));
        signatures.add(hash(mesh));
      }
      assert.equal(signatures.size, stitches.length, `${family}: changing stitch must change the whole surface`);
    }
  }
});

test("5 mm flap cord follows the rendered curved flap instead of a separate projection", () => {
  for (const family of Object.keys(specs)) {
    const surface = geometry.crochetFlapSurface(family);
    const radius = specs[family].rx * 5 / 160;
    for (const stitch of stitches) {
      const mesh = geometry.makeCrochetFlap(family, stitch);
      // Each tube ring has ten unique sides and a duplicated UV seam vertex.
      for (let ring = 0; ring < mesh.positions.length; ring += 33) {
        const center = [0, 0, 0];
        for (let side = 0; side < 10; side++) for (let axis = 0; axis < 3; axis++) center[axis] += mesh.positions[ring + side * 3 + axis] / 10;
        const seat = surface.sample(center[0], center[1]);
        assert.ok(seat, `${family}/${stitch}: cord remains on the flap outline`);
        assert.ok(seat.normal[2] > 0, "flap surface normals point outwards");
        const lift = center[2] - seat.z;
        assert.ok(lift > radius * .19 && lift < radius * 1.60, `${family}/${stitch}: yarn sits on the cloth (${lift})`);
      }
    }
  }
});

function gpu() {
  let bound;
  const state = { allocated: 0, deleted: 0 };
  return {
    state, ARRAY_BUFFER: 1, ELEMENT_ARRAY_BUFFER: 2, STATIC_DRAW: 3,
    createBuffer() { state.allocated++; return {}; },
    bindBuffer(_target, buffer) { bound = buffer; },
    bufferData(_target, data) { bound.data = data; },
    deleteBuffer() { state.deleted++; },
  };
}

test("flap rotation and recoloring reuse buffers while construction changes release them", () => {
  const gl = gpu(), renderer = { gl, meshes: {} };
  geometry.ensureCrochetFlapMesh(renderer, "round", "classic");
  assert.equal(gl.state.allocated, 4);
  geometry.ensureCrochetFlapMesh(renderer, "round", "classic");
  assert.equal(gl.state.allocated, 4);
  geometry.ensureCrochetFlapMesh(renderer, "mini", "basket");
  assert.equal(gl.state.deleted, 4);
  assert.equal(gl.state.allocated, 8);
  assert.equal(Object.keys(renderer.meshes).length, 1);
});

test("the metal snap clears the real cord crowns for every supported crocheted flap", () => {
  for (const family of ["round", "mini"]) for (const stitch of stitches) {
    const renderer = { gl: gpu(), meshes: {} };
    geometry.ensureCrochetFlapMesh(renderer, family, stitch);
    const positions = renderer.meshes.yarnFlap.position.data;
    const lockY = specs[family].ringY - .32;
    let highest = -Infinity;
    for (let i = 0; i < positions.length; i += 3) {
      if (Math.abs(positions[i]) < .077 && Math.abs(positions[i + 1] - lockY) < .050) highest = Math.max(highest, positions[i + 2]);
    }
    assert.ok(Number.isFinite(highest));
    assert.ok(renderer.crochetFlapLockZ - .021 > highest, `${family}/${stitch}: visible snap must clear the yarn`);
  }
});
