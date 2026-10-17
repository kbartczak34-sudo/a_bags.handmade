import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

const [renderer, familySource] = await Promise.all([
  readFile(new URL("../app/bag-builder-fidelity3d.tsx", import.meta.url), "utf8"),
  readFile(new URL("../lib/abags-fidelity-v4-family-spec.ts", import.meta.url), "utf8"),
]);

// Exercise the production mesh builders without mounting React or requiring a
// browser/GPU. No geometry or normal calculations are reimplemented here.
const start = renderer.indexOf("function clamp(");
const end = renderer.indexOf("function makeExtrudedContour(");
assert.ok(start >= 0 && end > start, "canonical mesh builders are available");
const { outputText } = ts.transpileModule(
  familySource.replace(/^export /gm, "") + "\n" + renderer.slice(start, end)
    + "\n({ makeVariableDepthBody, makeOpeningRim, makeOpeningInterior, openingLoop, familyContour, ABAGS_FIDELITY_V4_FAMILY_SPECS });",
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } },
);
const geometry = vm.runInNewContext(outputText, {}, { timeout: 5_000 });

const point = (values, vertex) => values.slice(vertex * 3, vertex * 3 + 3);
const bounds = (values, axis) => {
  let min = Infinity, max = -Infinity;
  for (let i = axis; i < values.length; i += 3) {
    min = Math.min(min, values[i]); max = Math.max(max, values[i]);
  }
  return { min, max };
};

function bodyAxisIntersections(mesh) {
  const heights = [];
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const [a, b, c] = mesh.indices.slice(i, i + 3).map((vertex) => point(mesh.positions, vertex));
    const determinant = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(determinant) < 1e-10) continue;
    const u = ((b[2] - c[2]) * -c[0] + (c[0] - b[0]) * -c[2]) / determinant;
    const v = ((c[2] - a[2]) * -c[0] + (a[0] - c[0]) * -c[2]) / determinant;
    if (u >= -1e-8 && v >= -1e-8 && u + v <= 1 + 1e-8) {
      heights.push(u * a[1] + v * b[1] + (1 - u - v) * c[1]);
    }
  }
  return heights;
}

for (const family of ["tote", "round", "bucket", "mini"]) {
  const spec = geometry.ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const body = geometry.makeVariableDepthBody(family);
  const rim = geometry.makeOpeningRim(family);
  const lining = geometry.makeOpeningInterior(family);

  test(`${family}: real mesh buffers are finite, normalized and fit unsigned-short indices`, () => {
    for (const [label, mesh] of Object.entries({ body, rim, lining })) {
      const vertices = mesh.positions.length / 3;
      assert.equal(mesh.normals.length, mesh.positions.length, `${label} normal count`);
      assert.equal(mesh.uvs.length, vertices * 2, `${label} UV count`);
      assert.equal(mesh.indices.length % 3, 0);
      assert.ok(vertices > 0 && vertices < 65_536, `${label} vertex budget`);
      for (const attribute of [mesh.positions, mesh.normals, mesh.uvs]) {
        assert.ok(attribute.every(Number.isFinite), `${label} finite attributes`);
      }
      for (const index of mesh.indices) {
        assert.ok(Number.isInteger(index) && index >= 0 && index < vertices && index < 65_536, `${label} valid index`);
      }
      for (let vertex = 0; vertex < vertices; vertex++) {
        assert.ok(Math.abs(Math.hypot(...point(mesh.normals, vertex)) - 1) < 1e-7, `${label} unit normal ${vertex}`);
      }
    }
  });

  test(`${family}: softened cloth preserves the canonical family width`, () => {
    const contour = geometry.familyContour(family);
    const actual = bounds(body.positions, 0);
    const expected = { min: Math.min(...contour.map(([x]) => x)), max: Math.max(...contour.map(([x]) => x)) };
    assert.ok(Math.abs(actual.min - expected.min) < 1e-10);
    assert.ok(Math.abs(actual.max - expected.max) < 1e-10);
  });

  test(`${family}: normals point outward and convex panels slope away from their centers`, () => {
    let frontSamples = 0, rearSamples = 0;
    for (let vertex = 0; vertex < body.positions.length / 3; vertex++) {
      const [x, y, z] = point(body.positions, vertex);
      const [nx, ny, nz] = point(body.normals, vertex);
      assert.ok(x * nx + y * ny + z * nz > 0, `outward normal ${vertex}`);
      if (Math.abs(x) > spec.rx * 0.35 && Math.abs(x) < spec.rx * 0.75
        && Math.abs(y) < spec.ry * 0.2 && Math.abs(z) > spec.depth * 0.4) {
        // This catches the former negative front X slope even when +Z alone
        // is enough for a superficially plausible outward normal.
        assert.ok(x * nx > 0.005, `convex horizontal normal ${vertex}`);
        assert.ok(z * nz > 0, `front/rear normal ${vertex}`);
        if (z > 0) frontSamples++; else rearSamples++;
      }
    }
    assert.ok(frontSamples >= 20 && rearSamples >= 20, "both physical cloth panels sampled");
  });

  test(`${family}: duplicate vertices across UV seams keep continuous physical normals`, () => {
    const locations = new Map();
    let seamSamples = 0;
    for (let vertex = 0; vertex < body.positions.length / 3; vertex++) {
      const position = point(body.positions, vertex);
      const key = position.map((value) => Math.round(value * 1e6)).join(":");
      const previous = locations.get(key);
      if (previous !== undefined) {
        const uvDifference = Math.hypot(body.uvs[vertex * 2] - body.uvs[previous * 2], body.uvs[vertex * 2 + 1] - body.uvs[previous * 2 + 1]);
        if (uvDifference > 0.001) {
          const normal = point(body.normals, vertex), other = point(body.normals, previous);
          assert.ok(Math.hypot(...normal.map((value, axis) => value - other[axis])) < 1e-9, `smooth UV seam ${vertex}`);
          seamSamples++;
        }
      } else locations.set(key, vertex);
    }
    assert.ok(seamSamples >= 100, "front/gusset/back UV seams sampled");
  });

  test(`${family}: mouth remains open and its lip and lining attach to the translated shell`, () => {
    const loop = geometry.openingLoop(family);
    const shellY = bounds(body.positions, 1);
    const openingTop = Math.max(...loop.map(([, y]) => y));
    assert.ok(Math.abs(openingTop - (shellY.max + spec.bodyY)) < 0.015, "lip follows body translation");

    for (const [x, y, z] of loop) {
      let nearest = Infinity;
      for (let vertex = 0; vertex < body.positions.length / 3; vertex++) {
        const [sx, sy, sz] = point(body.positions, vertex);
        if (sy < spec.ry * 0.8) continue;
        nearest = Math.min(nearest, Math.hypot(x - sx, y - (sy + spec.bodyY), z - sz));
      }
      assert.ok(nearest < 0.04, `lip touches shell within a cord diameter (${nearest})`);
    }

    const intersections = bodyAxisIntersections(body);
    assert.ok(intersections.length > 0, "axis reaches the closed bottom");
    assert.ok(Math.max(...intersections) < (shellY.min + shellY.max) * 0.5, "no shell triangles cap the upper mouth");
    assert.ok(bounds(lining.positions, 1).max < openingTop, "lining stays below the lip");
    assert.ok(bounds(lining.positions, 1).min < openingTop - 0.3, "lining has physical wall depth");
    assert.ok(Math.max(Math.abs(bounds(lining.positions, 0).min), Math.abs(bounds(lining.positions, 0).max))
      < Math.max(...loop.map(([x]) => Math.abs(x))), "lining stays inside the mouth width");
  });
}
