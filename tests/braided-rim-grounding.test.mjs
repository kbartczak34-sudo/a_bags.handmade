import assert from "node:assert/strict";
import test from "node:test";
import { geometry as g, specs } from "./helpers/fidelity-geometry.mjs";

const families = Object.keys(specs);
const fakeGL = () => ({ ARRAY_BUFFER: 1, ELEMENT_ARRAY_BUFFER: 2, STATIC_DRAW: 3, created: 0, deleted: 0,
  createBuffer() { this.created++; return {}; }, bindBuffer() {}, bufferData() {}, deleteBuffer() { this.deleted++; } });

test("the mouth binding is two closed three-dimensional cord strands within a 5 mm envelope", () => {
  for (const family of families) {
    const { paths, radius } = g.openingBraidPaths(family), cordRadius = specs[family].rx * 5 / 160;
    assert.equal(paths.length, 2);
    assert.ok(paths[0].length > 300 && paths[0].length < 1500);
    assert.ok(Math.abs(radius / cordRadius - .58) < 1e-8);
    for (const path of paths) {
      assert.ok(Math.hypot(...path[0].map((n, i) => n - path.at(-1)[i])) < 1e-8);
      for (let i = 1; i < path.length; i++) assert.ok(Math.hypot(...path[i].map((n, a) => n - path[i - 1][a])) < cordRadius);
    }
    const separation = paths[0].map((p, i) => Math.hypot(...p.map((n, a) => n - paths[1][i][a])));
    assert.ok(separation.every(d => Math.abs(d / cordRadius - .84) < 1e-7));
    assert.ok(Math.max(...paths[0].map((p, i) => Math.abs(p[1] - paths[1][i][1]))) > cordRadius * .7);
  }
});

test("braided rim has continuous tube seams, finite unit normals and portable WebGL indices", () => {
  for (const family of families) {
    const mesh = g.makeOpeningRim(family), vertices = mesh.positions.length / 3;
    assert.ok(vertices > 5000 && vertices < 65536);
    assert.equal(mesh.positions.length, mesh.normals.length);
    assert.equal(mesh.uvs.length, vertices * 2);
    assert.ok(mesh.positions.every(Number.isFinite));
    assert.ok(mesh.indices.every(i => Number.isInteger(i) && i >= 0 && i < vertices));
    for (let i = 0; i < mesh.normals.length; i += 3) assert.ok(Math.abs(Math.hypot(...mesh.normals.slice(i, i + 3)) - 1) < 1e-6);
    for (const start of [0, vertices / 2]) for (let i = 0; i < 9; i++) {
      const first = (start + i) * 3, last = (start + vertices / 2 - 9 + i) * 3;
      assert.ok(Math.hypot(...mesh.positions.slice(first, first + 3).map((n, a) => n - mesh.positions[last + a])) < 1e-7);
    }
    const outline = g.openingPath(family), center = [0, 1, 2].map(axis => outline.reduce((sum, p) => sum + p[axis], 0) / outline.length);
    const distance = (p, a, b) => {
      const d = b.map((n, i) => n - a[i]), delta = p.map((n, i) => n - a[i]);
      const t = Math.max(0, Math.min(1, delta.reduce((sum, n, i) => sum + n * d[i], 0) / d.reduce((sum, n) => sum + n * n, 0)));
      return Math.hypot(...delta.map((n, i) => n - t * d[i]));
    };
    const innerRadius = Math.min(...outline.map((p, i) => distance(center, p, outline[(i + 1) % outline.length])));
    const cordRadius = specs[family].rx * 5 / 160;
    for (let i = 0; i < mesh.positions.length; i += 3) assert.ok(Math.hypot(...mesh.positions.slice(i, i + 3).map((n, a) => n - center[a])) >= innerRadius - cordRadius * 1.1, "binding leaves the measured mouth open");
  }
});

test("mouth geometry is reused on recoloring and rotation, and old GPU buffers are released on family changes", () => {
  const gl = fakeGL(), renderer = { gl, meshes: {} };
  g.ensureOpeningRim(renderer, "tote"); const first = renderer.meshes.yarnRim;
  g.ensureOpeningRim(renderer, "tote");
  assert.equal(renderer.meshes.yarnRim, first);
  assert.equal(gl.created, 4);
  g.ensureOpeningRim(renderer, "mini");
  assert.equal(gl.deleted, 4);
  assert.equal(gl.created, 8);
  assert.equal(Object.keys(renderer.meshes).length, 1);
  assert.ok(renderer.rimTriangles > 1000);
});

test("cached contact vertices retain the true lower silhouette under all customer view angles", () => {
  for (const family of families) for (const stitch of ["classic", "basket"]) {
    const s = specs[family], front = g.makeCrochetPanel(family, stitch), side = g.makeCrochetGusset(family, stitch), shell = g.makeVariableDepthBody(family);
    const all = [];
    for (const [mesh, sign] of [[front, 1], [front, -1], [side, 1], [shell, 1]]) for (let i = 0; i < mesh.positions.length; i += 3) all.push([mesh.positions[i], mesh.positions[i + 1] + s.bodyY, mesh.positions[i + 2] * sign]);
    const lower = all.filter(p => p[1] < s.bodyY - s.ry * .70), support = g.groundSupportPoints(lower);
    assert.ok(support.length < 578 && support.length < lower.length / 15);
    for (const [pitch, yaw, zoom, aspect] of [[-.02, 0, .92, 806/668], [-.12, -.62, .92, 390/248], [-.07, Math.PI/2, .92, 390/248], [-.72, -2.4, 1.12, 1], [.56, 1.8, .58, 1]]) {
      const model = g.matrix([0, 0, 0], [zoom, zoom, zoom], [pitch, yaw, 0]);
      const reference = g.groundContactFrame(all, model, aspect, 668), actual = g.groundContactFrame(support, model, aspect, 668);
      assert.ok(Math.abs(reference.y - actual.y) * 668 < 1.5, `${family}/${stitch}: shadow must touch the real lower silhouette`);
      assert.ok(Number.isFinite(actual.x) && actual.width > 0 && actual.coreWidth <= actual.width);
      assert.ok(actual.blur >= 2 && actual.blur <= 7);
    }
  }
});

test("contact shadow follows zoom and suppresses an off-screen base without moving the bag", () => {
  const renderer = { gl: fakeGL(), meshes: {} };
  g.ensureCrochetMeshes(renderer, "tote", "classic");
  const points = renderer.groundPoints, original = JSON.stringify(points);
  const frame = zoom => g.groundContactFrame(points, g.matrix([0, 0, 0], [zoom, zoom, zoom]), 1, 700);
  const small = frame(.5), large = frame(1.1), clipped = frame(2);
  assert.ok(large.y > small.y && large.width > small.width);
  assert.equal(small.visible, 1);
  assert.equal(clipped.visible, 0);
  assert.equal(JSON.stringify(points), original);
  g.ensureCrochetMeshes(renderer, "tote", "classic");
  assert.equal(renderer.groundPoints, points);
});
