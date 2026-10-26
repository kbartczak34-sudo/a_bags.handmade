import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { geometry } from "./helpers/fidelity-geometry.mjs";

const source = await readFile(new URL("../app/bag-builder-fidelity3d.tsx", import.meta.url), "utf8");

test("hand-made yarn gauge has repeatable tension variations without random frame flicker", () => {
  assert.match(source, /const crossTension = Math\.sin\(/);
  assert.match(source, /const widthGauge = 1 \+ variation \* \.035/);
  assert.match(source, /const heightGauge = 1 \+ crossTension \* \.028/);
  assert.doesNotMatch(source, /Math\.random\(/);
  const a = geometry.makeCrochetPanel("tote", "classic");
  const b = geometry.makeCrochetPanel("tote", "classic");
  assert.ok(a.positions.length > 10000, "the yarn must be true 3D, not a flat sticker");
  assert.equal(a.positions.length, b.positions.length);
  assert.equal(a.indices.length, b.indices.length);
  for (let i = 0; i < a.positions.length; i += 31) {
    assert.ok(Number.isFinite(a.positions[i]), "cord vertices must stay finite");
    assert.equal(a.positions[i], b.positions[i], "same saved bag produces same stitched geometry");
  }
  assert.ok(a.positions.length / 3 <= 65535, "WebGL1 vertex index budget remains valid");
  assert.ok(a.indices.every(index => index >= 0 && index < a.positions.length / 3));
});

test("5 mm polyester cord uses filtered two-scale filament surface in native WebGL", () => {
  assert.match(source, /function appendCord\(/);
  assert.match(source, /const yarnRadius = thickness \* \(1/);
  assert.match(source, /\.018 \* Math\.sin\(distance \* 19\.3/);
  assert.match(source, /\.009 \* Math\.sin\(distance \* 43\.7/);
  assert.match(source, /n\[axis\] \* yarnRadius/);
  assert.match(source, /distance \/ \(thickness \* 1\.6\)/);
  assert.match(source, /float yarnFilaments\(vec2 uv\)/);
  assert.match(source, /dFdx\(phase\)/);
  assert.match(source, /dFdy\(phase\)/);
  assert.match(source, /float filament=yarnFilaments\(vUv\)/);
  assert.match(source, /rough=\.735\+\.055/);
  assert.match(source, /return 0\.0;\s*#endif\s*}\s*vec3 cordBraidNormal/);
  assert.match(source, /drawMesh\(renderer, meshes\.yarnFront, bodyModel, body, 7/);
  assert.match(source, /drawMesh\(renderer, meshes\.yarnBack, bodyModel, body, 7/);
  assert.match(source, /drawMesh\(renderer, meshes\.yarnSide, bodyModel, body, 7/);
});

test("hand tension preserves volumetric yarn for basket and shell stitches", () => {
  for (const stitch of ["basket", "shell"]) {
    const mesh = geometry.makeCrochetPanel("mini", stitch);
    const points = mesh.positions.length / 3;
    assert.ok(points > 1000 && points <= 65535, stitch);
    assert.equal(mesh.normals.length, mesh.positions.length, stitch);
    assert.equal(mesh.uvs.length, points * 2, stitch);
    assert.equal(mesh.indices.length % 3, 0, stitch);
    assert.ok(mesh.indices.every(index => Number.isInteger(index) && index < points), stitch);
  }
});

test("three-ply cord has genuine helical relief, continuous seams and tilted surface normals", () => {
  assert.match(source, /const plyPhase = 3 \* angle - twist \* \.8/);
  assert.match(source, /const plyRadius = 1 \+ \.023 \* Math\.cos/);
  assert.match(source, /mesh\.normals\.push\(\.\.\.surfaceNormal\)/);
  const thickness = .03, sides = 10;
  const mesh = { positions: [], normals: [], uvs: [], indices: [] };
  const points = Array.from({ length: 36 }, (_, i) => [i * .02, 0, 0]);
  geometry.appendCord(mesh, points, thickness, () => [0, 0, 1], () => true, sides);
  const ringSize = sides + 1;
  assert.equal(mesh.positions.length / 3, points.length * ringSize);
  assert.equal(mesh.indices.length, (points.length - 1) * sides * 6);
  let reliefDetected = false, normalTiltDetected = false;
  for (let ring = 0; ring < points.length; ring++) {
    const radii = [];
    for (let side = 0; side <= sides; side++) {
      const offset = 3 * (ring * ringSize + side);
      const x = mesh.positions[offset], y = mesh.positions[offset + 1], z = mesh.positions[offset + 2];
      const nx = mesh.normals[offset], ny = mesh.normals[offset + 1], nz = mesh.normals[offset + 2];
      const radius = Math.hypot(y, z);
      radii.push(radius);
      assert.ok(radius > thickness * .93 && radius < thickness * 1.07, "5 mm gauge remains bounded");
      assert.ok(Math.abs(x - points[ring][0]) < 1e-8, "ply remains anchored to its 3D stitch path");
      assert.ok(Math.abs(Math.hypot(nx, ny, nz) - 1) < 1e-6, "normal is normalized");
      if (Math.abs(nx) > .025) normalTiltDetected = true;
    }
    if (Math.max(...radii) - Math.min(...radii) > thickness * .02) reliefDetected = true;
    for (const field of ["positions", "normals"]) {
      const a = mesh[field].slice(3 * (ring * ringSize), 3 * (ring * ringSize) + 3);
      const b = mesh[field].slice(3 * (ring * ringSize + sides), 3 * (ring * ringSize + sides) + 3);
      for (let i = 0; i < 3; i++) assert.ok(Math.abs(a[i] - b[i]) < 1e-6, "seam closure");
    }
  }
  assert.ok(reliefDetected, "visible yarn relief is part of actual mesh geometry");
  assert.ok(normalTiltDetected, "mesh lighting follows twisting plies rather than a smooth plastic tube");
});
