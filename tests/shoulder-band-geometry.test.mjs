import assert from "node:assert/strict";
import test from "node:test";
import { geometry as g, specs } from "./helpers/fidelity-geometry.mjs";

const families = Object.keys(specs), kinds = ["woven", "leather"];
const dot = (a, b) => a.reduce((s, n, i) => s + n * b[i], 0);

test("shoulder straps have two broad faces, thin rounded edges and closed ends", () => {
  for (const family of families) for (const kind of kinds) {
    const mesh = g.familyShoulderStrapMesh(family, kind);
    for (const row of [0, 21, 42, 63, 84]) {
      const f = g.shoulderBandFrame(family, row / 84, kind);
      const ring = Array.from({ length: 12 }, (_, i) => mesh.positions.slice((row * 13 + i) * 3, (row * 13 + i + 1) * 3).map((n, axis) => n - f.center[axis]));
      const across = ring.map(p => dot(p, f.widthAxis)), depth = ring.map(p => dot(p, f.normal));
      const width = Math.max(...across) - Math.min(...across), thickness = Math.max(...depth) - Math.min(...depth);
      assert.ok(width / thickness > 3.7, `${family}/${kind}: strap reads as a band rather than a round tube`);
      assert.ok(Math.abs(width - f.halfWidth * 2) < 1e-8);
      assert.ok(Math.abs(thickness - f.halfThickness * 2) < 1e-8);
    }
    // Each end has a full twelve-triangle cap with an outward axial normal.
    const caps = mesh.indices.slice(-72);
    assert.equal(new Set(caps).size, 26);
    assert.ok(mesh.normals.slice(-78).every(Number.isFinite));
  }
});

test("band ends retain the actual clasp positions while the shoulder section bends through depth", () => {
  for (const family of families) for (const kind of kinds) {
    const pose = g.shoulderStrapMatrix(family);
    for (const side of [-1, 1]) {
      const f = g.shoulderBandFrame(family, side < 0 ? 0 : 1, kind), ring = g.strapHardwarePosition(family, side);
      const end = f.center.map((n, i) => n + pose[12 + i]);
      assert.ok(Math.abs(end[0] - ring[0]) < 1e-6);
      assert.ok(Math.abs(end[1] - ring[1] - .06) < 1e-6);
      assert.ok(Math.abs(end[2] - ring[2]) < 1e-6);
    }
    const middle = g.shoulderBandFrame(family, .5, kind);
    assert.ok(middle.center[2] < -.1 && middle.center[2] >= -.13);
    assert.ok(middle.halfWidth > g.shoulderBandFrame(family, 0, kind).halfWidth * 1.4);
    for (let i = 0; i <= 100; i++) {
      const f = g.shoulderBandFrame(family, i / 100, kind);
      for (const axis of [f.widthAxis, f.normal, f.tangent]) assert.ok(Math.abs(Math.hypot(...axis) - 1) < 1e-8);
      assert.ok(Math.abs(dot(f.widthAxis, f.normal)) < 1e-8);
      assert.ok(Math.abs(dot(f.widthAxis, f.tangent)) < 1e-8);
    }
  }
});

test("band faces, bound edges and sewn threads have valid portable WebGL meshes and complete world bounds", () => {
  for (const family of families) for (const kind of kinds) {
    const { parts, bounds } = g.makeShoulderBandGeometry(family, kind), pose = g.shoulderStrapMatrix(family);
    assert.equal(parts.length, kind === "leather" ? 3 : 4);
    for (const { mesh } of parts) {
      const vertices = mesh.positions.length / 3;
      assert.ok(vertices > 100 && vertices < 65536);
      assert.equal(mesh.normals.length, mesh.positions.length);
      assert.equal(mesh.uvs.length, vertices * 2);
      assert.ok(mesh.positions.every(Number.isFinite));
      assert.ok(mesh.uvs.every(Number.isFinite));
      assert.ok(mesh.indices.every(i => Number.isInteger(i) && i >= 0 && i < vertices));
      for (let i = 0; i < mesh.normals.length; i += 3) assert.ok(Math.abs(Math.hypot(...mesh.normals.slice(i, i + 3)) - 1) < 1e-5);
      for (let i = 0; i < mesh.positions.length; i++) {
        const axis = i % 3, value = mesh.positions[i] + pose[12 + axis];
        assert.ok(value >= bounds.min[axis] && value <= bounds.max[axis]);
      }
    }
    assert.ok(bounds.max[2] - bounds.min[2] > .10);
  }
});

test("stitches sit against both band faces and leave real gaps between needle passes", () => {
  for (const kind of kinds) {
    const { parts } = g.makeShoulderBandGeometry("mini", kind), seam = parts.find(p => p.tone === "stitch").mesh;
    // Each sewn segment contains three circular rings, with a repeated UV seam.
    const stride = 3 * 9;
    assert.equal(seam.positions.length / 3, 384 * stride);
    for (let piece = 0; piece < 384; piece++) {
      const i = piece % 96, face = Math.floor(piece / 96) % 2 ? 1 : -1;
      const t = .020 + i * .010, f = g.shoulderBandFrame("mini", t, kind);
      const first = [0, 0, 0];
      for (let j = 0; j < 8; j++) for (let axis = 0; axis < 3; axis++) first[axis] += seam.positions[(piece * stride + j) * 3 + axis] / 8;
      const offset = first.map((n, axis) => n - f.center[axis]);
      assert.ok(Math.abs(dot(offset, f.normal) * face - f.halfThickness) < .002);
      assert.ok(Math.abs(dot(offset, f.widthAxis)) < f.halfWidth);
    }
    assert.equal(seam.indices.length, 384 * 2 * 8 * 6, "disconnected needle passes do not turn into solid piping");
  }
});

test("band GPU cache reuses appearance changes and frees all parts when replaced or removed", () => {
  let allocated = 0;
  const deleted = new Set(), gl = { ARRAY_BUFFER: 1, ELEMENT_ARRAY_BUFFER: 2, STATIC_DRAW: 3, createBuffer: () => ({ id: ++allocated }), bindBuffer() {}, bufferData() {}, deleteBuffer(b) { assert.ok(!deleted.has(b)); deleted.add(b); } };
  const renderer = { gl, meshes: {} }, c = { family: "mini", strap: "woven" };
  g.ensureShoulderBandMeshes(renderer, c);
  const first = renderer.shoulderBandParts;
  assert.equal(allocated, 16);
  g.ensureShoulderBandMeshes(renderer, { ...c, color: "#087E81", hardware: "black", accent: "charm", stitch: "basket" });
  assert.equal(renderer.shoulderBandParts, first);
  assert.equal(allocated, 16);
  g.ensureShoulderBandMeshes(renderer, { family: "bucket", strap: "leather" });
  assert.equal(deleted.size, 16);
  assert.equal(allocated, 28);
  assert.ok(renderer.shoulderBandTriangles > 100);
  for (const strap of ["none", "chain"]) {
    g.ensureShoulderBandMeshes(renderer, { family: "bucket", strap });
    assert.equal(deleted.size, allocated);
    assert.equal(Object.keys(renderer.meshes).length, 0);
    assert.equal(renderer.shoulderBandBounds, undefined);
    assert.equal(renderer.shoulderBandTriangles, 0);
  }
});
