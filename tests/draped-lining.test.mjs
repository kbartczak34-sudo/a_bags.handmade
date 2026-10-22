import test from "node:test";
import assert from "node:assert/strict";
import { geometry, specs } from "./helpers/fidelity-geometry.mjs";

for (const family of Object.keys(specs)) {
  test(`${family}: lining reaches into the body, stays open and closes at its actual base`, () => {
    const spec = specs[family], mesh = geometry.makeOpeningInterior(family);
    const layout = geometry.openingLiningLayout(family);
    const positions = Array.from({ length: mesh.positions.length / 3 }, (_, i) => mesh.positions.slice(i * 3, i * 3 + 3));
    assert.ok(layout.topY - layout.bottomY > spec.ry * 1.5, "floor must not sit just below the mouth");
    assert.ok(Math.abs(Math.min(...positions.map(p => p[1])) - layout.bottomY) < 1e-8);
    assert.ok(positions.every(([x, y, z]) => Math.abs(x) < spec.rx && y >= spec.bodyY - spec.ry
      && y < layout.topY && Math.abs(z) < geometry.depthAt(family, y - spec.bodyY) / 2), "lining must remain inside the existing shell");
    const bottom = positions.filter(p => Math.abs(p[1] - layout.bottomY) < 1e-8);
    assert.ok(bottom.some(([x,,z]) => x === 0 && z === 0), "base must close at its center");
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const triangle = mesh.indices.slice(i, i + 3).map(index => positions[index]);
      const [a, b, c] = triangle, dx = b[0] - a[0], dz = b[2] - a[2], ex = c[0] - a[0], ez = c[2] - a[2];
      const determinant = dx * ez - dz * ex;
      if (Math.abs(determinant) < 1e-10) continue;
      const u = (-a[0] * ez + a[2] * ex) / determinant, v = (-dx * a[2] + dz * a[0]) / determinant;
      if (u >= -1e-8 && v >= -1e-8 && u + v <= 1 + 1e-8)
        assert.ok(a[1] + u * (b[1] - a[1]) + v * (c[1] - a[1]) <= layout.bottomY + .01, "a ray through the open mouth must reach the base");
    }
  });
}

test("lining folds have inward unit normals, continuous seam positions and portable indices", () => {
  for (const family of Object.keys(specs)) {
    const mesh = geometry.makeOpeningInterior(family), layout = geometry.openingLiningLayout(family);
    assert.ok(mesh.positions.length / 3 < 65535);
    assert.ok([...mesh.positions, ...mesh.normals, ...mesh.uvs].every(Number.isFinite));
    assert.ok(mesh.indices.every(i => Number.isInteger(i) && i >= 0 && i < mesh.positions.length / 3));
    for (let i = 0; i < mesh.normals.length; i += 3) assert.ok(Math.abs(Math.hypot(...mesh.normals.slice(i, i + 3)) - 1) < 1e-6);
    for (const u of [0, .12, .31, .55, .78, 1]) for (const t of [0, .3, .7, 1]) {
      const a = geometry.liningWallPoint(layout, u, t), b = geometry.liningWallPoint(layout, u + 1, t);
      assert.ok(Math.hypot(...a.map((n, i) => n - b[i])) < 1e-8, "wrap seam must close exactly");
    }
    const linear = geometry.liningWallPoint(layout, .123, .5);
    const a = geometry.liningWallPoint(layout, .123, 0), b = geometry.liningWallPoint(layout, .123, 1);
    assert.ok(Math.hypot(linear[0] - (a[0] + b[0]) / 2, linear[2] - (a[2] + b[2]) / 2) > .0001, "cloth must have physical folds");
  }
});

test("the lining has a separate fine sewing thread just below the existing braided rim", () => {
  for (const family of Object.keys(specs)) {
    const mesh = geometry.makeOpeningLiningSeam(family), layout = geometry.openingLiningLayout(family);
    assert.ok(mesh.indices.length / 3 > 500 && mesh.positions.length / 3 < 65535);
    const top = Math.max(...Array.from({ length: mesh.positions.length / 3 }, (_, i) => mesh.positions[i * 3 + 1]));
    assert.ok(top < layout.topY - .025 && top > layout.topY - .075);
    assert.ok([...mesh.positions, ...mesh.normals, ...mesh.uvs].every(Number.isFinite));
  }
});
