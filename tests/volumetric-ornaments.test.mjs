import assert from "node:assert/strict";
import test from "node:test";
import { geometry as g, specs } from "./helpers/fidelity-geometry.mjs";

const families = Object.keys(specs);
const accents = ["tassel", "scarf", "bow", "charm"];
const config = (family, accent, handles = "none") => ({ family, accent, handles });
const emptyMesh = () => ({ positions: [], normals: [], uvs: [], indices: [] });

test("all ornament constructions have finite volume, unit normals, and portable 16-bit meshes", () => {
  for (const family of families) for (const accent of accents) for (const handles of ["none", "wood-light"]) {
    const { parts, bounds } = g.makeOrnamentGeometry(config(family, accent, handles));
    assert.ok(parts.length >= 2 && parts.length <= 4);
    assert.equal(new Set(parts.map(p => p.name)).size, parts.length);
    for (const { mesh } of parts) {
      const vertices = mesh.positions.length / 3;
      assert.ok(vertices > 100 && vertices < 65536);
      assert.equal(mesh.normals.length, mesh.positions.length);
      assert.equal(mesh.uvs.length, vertices * 2);
      assert.ok(mesh.positions.every(Number.isFinite));
      assert.ok(mesh.uvs.every(Number.isFinite));
      assert.ok(mesh.indices.every(i => Number.isInteger(i) && i >= 0 && i < vertices));
      for (let i = 0; i < mesh.normals.length; i += 3) assert.ok(Math.abs(Math.hypot(...mesh.normals.slice(i, i + 3)) - 1) < 1e-5);
      for (let i = 0; i < mesh.positions.length; i++) assert.ok(mesh.positions[i] >= bounds.min[i % 3] && mesh.positions[i] <= bounds.max[i % 3]);
    }
    assert.ok(bounds.max[2] - bounds.min[2] > .05, `${family}/${accent}: actual depth, rather than a planar decal`);
    assert.ok(bounds.max[1] - bounds.min[1] > .3);
  }
});

test("draped ornament surfaces stay outside the bag's highest cord envelope", () => {
  for (const family of families) for (const accent of accents) {
    const { parts } = g.makeOrnamentGeometry(config(family, accent));
    const s = specs[family];
    let checked = 0, closest = Infinity;
    for (const { mesh } of parts) for (let i = 0; i < mesh.positions.length; i += 3) {
      const [x, worldY, z] = mesh.positions.slice(i, i + 3), y = worldY - s.bodyY;
      const fraction = (Math.abs(x / (s.rx * (1 + s.taper * y / s.ry))) ** s.power + Math.abs(y / s.ry) ** s.power) ** (1 / s.power);
      // The outer contour is intentionally open; inspect the physical front face.
      if (fraction >= .94) continue;
      const gap = z - g.crochetPanelPoint(family, x, y)[2] - s.rx * 5 / 160 * 1.75;
      assert.ok(gap > .001, `${family}/${accent}: ornament intersects the real cord (${gap})`);
      closest = Math.min(closest, gap); checked++;
    }
    assert.ok(checked > 1000);
    assert.ok(closest < .045, `${family}/${accent}: ornament floats away from its attachment`);
  }
});

test("scarf ribbon has two opposing fabric faces and closed physical edges", () => {
  const mesh = emptyMesh(), rows = 5, columns = 3;
  g.appendOrnamentRibbon(mesh, (u, v) => [u, v, 0], rows, columns);
  const face = (rows + 1) * (columns + 1);
  for (let i = 0; i < face; i++) {
    const a = i * 3, b = (i + face) * 3;
    assert.ok(Math.abs(Math.hypot(...mesh.positions.slice(a, a + 3).map((n, axis) => n - mesh.positions[b + axis])) - .0036) < 1e-8);
    assert.ok(mesh.normals.slice(a, a + 3).every((n, axis) => Math.abs(n + mesh.normals[b + axis]) < 1e-8));
  }
  const edges = new Map();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const t = mesh.indices.slice(i, i + 3);
    for (let j = 0; j < 3; j++) {
      const key = [t[j], t[(j + 1) % 3]].sort((a, b) => a - b).join("|");
      edges.set(key, (edges.get(key) || 0) + 1);
    }
  }
  assert.ok([...edges.values()].every(count => count === 2), "no open or disconnected fabric edges");
});

test("ornament GPU cache reuses color changes and releases every old buffer on replacement or removal", () => {
  let allocated = 0;
  const deleted = new Set();
  const gl = { ARRAY_BUFFER: 1, ELEMENT_ARRAY_BUFFER: 2, STATIC_DRAW: 3, createBuffer: () => ({ id: ++allocated }), bindBuffer() {}, bufferData() {}, deleteBuffer(buffer) { assert.ok(!deleted.has(buffer)); deleted.add(buffer); } };
  const renderer = { gl, meshes: {} };
  g.ensureOrnamentMeshes(renderer, config("mini", "tassel"));
  const parts = renderer.ornamentParts, bounds = renderer.ornamentBounds, firstAllocation = allocated;
  g.ensureOrnamentMeshes(renderer, { ...config("mini", "tassel", "wood-light"), color: "#087E81", hardware: "black", stitch: "basket" });
  assert.equal(renderer.ornamentParts, parts);
  assert.equal(renderer.ornamentBounds, bounds);
  assert.equal(allocated, firstAllocation);
  for (const next of [config("tote", "scarf"), config("tote", "scarf", "wood-light"), config("round", "charm")]) {
    const previous = allocated;
    g.ensureOrnamentMeshes(renderer, next);
    assert.equal(deleted.size, previous);
    assert.equal(Object.keys(renderer.meshes).length, renderer.ornamentParts.length);
    assert.ok(renderer.ornamentTriangles > 100);
  }
  g.ensureOrnamentMeshes(renderer, config("round", "none"));
  assert.equal(deleted.size, allocated);
  assert.equal(Object.keys(renderer.meshes).length, 0);
  assert.equal(renderer.ornamentParts.length, 0);
  assert.equal(renderer.ornamentBounds, undefined);
  assert.equal(renderer.ornamentTriangles, 0);
});

test("wooden-handle scarf wraps behind its ring while the bow and tails remain in front", () => {
  for (const family of ["tote", "mini"]) {
    const c = config(family, "scarf", "wood-light"), anchor = g.fidelityAccessoryAnchor(c);
    const { parts, bounds } = g.makeOrnamentGeometry(c);
    const cloth = parts.find(p => p.tone === "scarf").mesh;
    assert.ok(bounds.min[2] < anchor[2] - .09);
    assert.ok(bounds.max[2] > anchor[2] + .12);
    assert.ok(cloth.positions.some((z, i) => i % 3 === 2 && z < anchor[2] - .09 && Math.abs(cloth.positions[i - 1] - anchor[1]) < .03));
    assert.ok(bounds.min[1] < anchor[1] - .4, "real hanging tails below the knot");
  }
});

test("removing an ornament or leaving the family has no geometry or residual bounds", () => {
  for (const c of [config("mini", "none"), config("", "tassel")]) {
    const data = g.makeOrnamentGeometry(c);
    assert.equal(data.parts.length, 0);
    assert.equal(data.bounds, undefined);
  }
});
