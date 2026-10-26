import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { geometry, specs } from "./helpers/fidelity-geometry.mjs";

test("hand-crocheted 5 mm stitch has attached ends, rounded shoulders and alternating three-dimensional crossing", () => {
  const radius = 1.03 * 5 / 160;
  const width = .12, height = .10, drift = .002;
  const at = (t) => geometry.atelierCordLoopOffset(t, width, height, radius, drift);
  const first = at(0), last = at(1);
  assert.ok(Math.abs(first[0] + width * .43) < 1e-9);
  assert.ok(Math.abs(last[0] - width * .43) < 1e-9);
  assert.ok(Math.abs(first[1] - last[1]) < 1e-9);
  assert.ok(Math.abs(first[2]) < 1e-9 && Math.abs(last[2]) < 1e-9);
  assert.ok(at(.25)[2] > radius * .15, "left leg rises out of the fabric");
  assert.ok(at(.75)[2] < -radius * .15, "right leg passes under it");
  const knots = Array.from({ length: 65 }, (_, index) => at(index / 64));
  for (const point of knots) {
    assert.ok(point.every(Number.isFinite), "stitch stays finite");
    assert.ok(Math.abs(point[2]) < radius * .4, "crossing lift stays below one cord radius");
  }
  for (let i = 1; i < knots.length; i++) {
    assert.ok(Math.hypot(...knots[i].map((v, axis) => v - knots[i - 1][axis])) < height * .09, "no angular gap in the sewn yarn");
  }
});

test("all reference-facing crochet tubes keep WebGL1 portability and unit normals", () => {
  for (const family of ["tote", "round", "mini", "tall-tote", "shoulder"]) {
    for (const stitch of ["classic", "herringbone"]) {
      const mesh = geometry.makeCrochetPanel(family, stitch);
      const vertices = mesh.positions.length / 3;
      assert.ok(vertices > 1000 && vertices <= 65535, family + "/" + stitch);
      assert.equal(mesh.normals.length, mesh.positions.length);
      assert.equal(mesh.uvs.length, vertices * 2);
      assert.ok(mesh.positions.every(Number.isFinite));
      assert.ok(mesh.indices.every(index => Number.isInteger(index) && index >= 0 && index < vertices));
      for (let i = 0; i < mesh.normals.length; i += 3) {
        assert.ok(Math.abs(Math.hypot(...mesh.normals.slice(i, i + 3)) - 1) < .001);
      }
    }
    assert.ok(specs[family].rx > 0);
  }
});

test("polyester filament shading is tube-attached and derivative-filtered on mobile GPU", async () => {
  const source = await readFile(new URL("../app/bag-builder-fidelity3d.tsx", import.meta.url), "utf8");
  const filament = source.slice(source.indexOf("// Polyester cord is spun"), source.indexOf("} else if(uMaterial<8.5)"));
  assert.match(filament, /vUv\.y\*19\.0\+vUv\.x\*\.24/);
  assert.match(filament, /float fibreResolve=0\.0;/);
  assert.match(filament, /#ifdef ABAGS_HAS_DERIVATIVES[\s\S]*dFdx\(fibreUv\)[\s\S]*dFdy\(fibreUv\)/);
  assert.match(filament, /smoothstep\(\.18,\.58,fibreFootprint\)/);
  assert.match(filament, /rough=\.75/);
  assert.ok(!filament.includes("gl_FragCoord"), "cord fibres must not become a flat screen-space overlay");
});
