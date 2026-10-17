import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { Triangle, Vector3 } from "three";
import ts from "typescript";

const [familySource, cordSource, rendererSource] = await Promise.all([
  readFile(new URL("../lib/abags-fidelity-v4-family-spec.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/abags-crochet-geometry.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-fidelity3d.tsx", import.meta.url), "utf8"),
]);

const transpile = (source) => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(transpile(source)).toString("base64")}`;
const familyUrl = moduleUrl(familySource);
const { ABAGS_FIDELITY_V4_FAMILY_SPECS: specs } = await import(familyUrl);
const { createCrochetCordMeshes } = await import(moduleUrl(cordSource.replace(
  /(["'])\.\/abags-fidelity-v4-family-spec\1/g,
  JSON.stringify(familyUrl),
)));

// Use the actual renderer shell to catch cords detached from its dome or its
// softened silhouette. The production geometry is not copied into this test.
const geometryStart = rendererSource.indexOf("function clamp(");
const geometryEnd = rendererSource.indexOf("function makeExtrudedContour(");
assert.ok(geometryStart >= 0 && geometryEnd > geometryStart, "canonical shell builders are available");
const { makeVariableDepthBody } = vm.runInNewContext(transpile(
  familySource.replace(/^export /gm, "") + "\n"
    + rendererSource.slice(geometryStart, geometryEnd)
    + "\n({ makeVariableDepthBody });",
), {}, { timeout: 5_000 });

const RING_VERTICES = 9;
const RADIAL_SIDES = RING_VERTICES - 1;
const families = Object.keys(specs);
const point = (values, vertex) => values.slice(vertex * 3, vertex * 3 + 3);
const distance = (a, b) => Math.hypot(...a.map((value, axis) => value - b[axis]));
const dot = (a, b) => a.reduce((sum, value, axis) => sum + value * b[axis], 0);
const bounds = (meshes, axis) => {
  let min = Infinity, max = -Infinity;
  for (const mesh of meshes) for (let i = axis; i < mesh.positions.length; i += 3) {
    min = Math.min(min, mesh.positions[i]);
    max = Math.max(max, mesh.positions[i]);
  }
  return { min, max };
};
const rings = (meshes) => meshes.flatMap((mesh) => {
  const result = [];
  for (let start = 0; start < mesh.positions.length / 3; start += RING_VERTICES) {
    const positions = Array.from({ length: RING_VERTICES }, (_, offset) => point(mesh.positions, start + offset));
    const normals = Array.from({ length: RING_VERTICES }, (_, offset) => point(mesh.normals, start + offset));
    const center = [0, 1, 2].map((axis) => positions.slice(0, RADIAL_SIDES)
      .reduce((sum, value) => sum + value[axis], 0) / RADIAL_SIDES);
    result.push({ positions, normals, center });
  }
  return result;
});

function shellTriangles(shell) {
  const triangles = [];
  for (let i = 0; i < shell.indices.length; i += 3) {
    const vertices = shell.indices.slice(i, i + 3).map((vertex) => point(shell.positions, vertex));
    triangles.push({
      surface: new Triangle(...vertices.map((vertex) => new Vector3(...vertex))),
      bounds: [0, 1, 2].map((axis) => ({
        min: Math.min(...vertices.map((vertex) => vertex[axis])),
        max: Math.max(...vertices.map((vertex) => vertex[axis])),
      })),
    });
  }
  return triangles;
}

// Query actual triangles, not their vertices: the canonical gusset has long
// segments whose midpoint can be far from the nearest discrete shell vertex.
function nearestShellSurface(center, triangles) {
  let closestSquared = Infinity;
  const query = new Vector3(...center), closest = new Vector3();
  for (const triangle of triangles) {
    let boxDistanceSquared = 0;
    for (let axis = 0; axis < 3; axis++) {
      const gap = Math.max(0, triangle.bounds[axis].min - center[axis], center[axis] - triangle.bounds[axis].max);
      boxDistanceSquared += gap * gap;
    }
    if (boxDistanceSquared >= closestSquared) continue;
    triangle.surface.closestPointToPoint(query, closest);
    closestSquared = Math.min(closestSquared, closest.distanceToSquared(query));
  }
  return Math.sqrt(closestSquared);
}

for (const family of families) {
  const spec = specs[family];
  const meshes = createCrochetCordMeshes(family, 0);
  const allRings = rings(meshes);

  test(`${family}: physical crochet buffers are finite and safe for WebGL unsigned-short chunks`, () => {
    assert.ok(meshes.length >= 2, "the body has enough physical yarn to require multiple bounded chunks");
    let totalVertices = 0;
    for (const [chunk, mesh] of meshes.entries()) {
      const vertexCount = mesh.positions.length / 3;
      totalVertices += vertexCount;
      assert.ok(Number.isInteger(vertexCount) && vertexCount > 0 && vertexCount <= 60_000, `chunk ${chunk} vertex budget`);
      assert.equal(vertexCount % RING_VERTICES, 0, "chunk boundaries preserve complete tube rings");
      assert.equal(mesh.normals.length, mesh.positions.length, "one normal per physical vertex");
      assert.equal(mesh.uvs.length, vertexCount * 2, "one UV pair per physical vertex");
      assert.ok(mesh.indices.length > 0 && mesh.indices.length % 3 === 0, "actual triangles are emitted");
      for (const values of [mesh.positions, mesh.normals, mesh.uvs]) {
        assert.ok(values.every(Number.isFinite), `chunk ${chunk} finite attributes`);
      }
      for (const index of mesh.indices) {
        assert.ok(Number.isInteger(index) && index >= 0 && index < vertexCount && index < 65_536, `chunk ${chunk} valid element index`);
      }
      const referenced = new Set(mesh.indices);
      const ringJoins = new Set();
      assert.equal(referenced.size, vertexCount, "all emitted tube vertices belong to rendered triangles");
      for (let triangle = 0; triangle < mesh.indices.length; triangle += 3) {
        const indices = mesh.indices.slice(triangle, triangle + 3);
        const ringIds = indices.map((index) => Math.floor(index / RING_VERTICES));
        assert.equal(Math.max(...ringIds) - Math.min(...ringIds), 1, "tube triangles join adjacent cross-sections");
        ringJoins.add(Math.min(...ringIds));
        const [a, b, c] = indices.map((index) => point(mesh.positions, index));
        const ab = b.map((value, axis) => value - a[axis]);
        const ac = c.map((value, axis) => value - a[axis]);
        const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
        assert.ok(Math.hypot(...cross) > 1e-12, "rendered tube triangles have physical area");
      }
      let loopStart = 0;
      for (let ring = 0; ring < vertexCount / RING_VERTICES; ring++) {
        if (ringJoins.has(ring)) continue;
        assert.ok(ring - loopStart >= 10, "each yarn loop has a sampled continuous path");
        for (let radial = 0; radial < RING_VERTICES; radial++) {
          const first = loopStart * RING_VERTICES + radial, last = ring * RING_VERTICES + radial;
          assert.ok(distance(point(mesh.positions, first), point(mesh.positions, last)) < 1e-9, "hooked cord closes without a dangling end");
          assert.ok(distance(point(mesh.normals, first), point(mesh.normals, last)) < 1e-9, "closed cord has a continuous normal seam");
        }
        loopStart = ring + 1;
      }
      for (let vertex = 0; vertex < vertexCount; vertex++) {
        assert.ok(Math.abs(Math.hypot(...point(mesh.normals, vertex)) - 1) < 1e-7, `chunk ${chunk} unit normal ${vertex}`);
      }
    }
    assert.ok(totalVertices > 60_000 && totalVertices < 240_000, "dense yarn geometry stays within a mobile-sized budget");
  });

  test(`${family}: yarn has closed round cross-sections and radial normals in physical 3D`, () => {
    const nominalRadius = spec.rx * (0.005 / 0.16);
    let depthBearingRings = 0;
    for (const [index, ring] of allRings.entries()) {
      assert.ok(distance(ring.positions[0], ring.positions[RADIAL_SIDES]) < 1e-9, `ring ${index} position seam closes`);
      assert.ok(distance(ring.normals[0], ring.normals[RADIAL_SIDES]) < 1e-9, `ring ${index} normal seam closes`);
      const radii = ring.positions.slice(0, RADIAL_SIDES).map((position) => distance(position, ring.center));
      const expectedRadius = radii[0] < nominalRadius * 0.8 ? nominalRadius * 0.60 : nominalRadius;
      for (let side = 0; side < RADIAL_SIDES; side++) {
        assert.ok(Math.abs(radii[side] / expectedRadius - 1) < 0.055, `ring ${index} body or braided-border cord radius`);
        const radial = ring.positions[side].map((value, axis) => (value - ring.center[axis]) / radii[side]);
        assert.ok(dot(radial, ring.normals[side]) > 0.999, `ring ${index} outward radial normal`);
        assert.ok(dot(ring.normals[side], ring.normals[(side + 4) % RADIAL_SIDES]) < -0.999, `ring ${index} opposite cord faces`);
        assert.ok(Math.abs(dot(ring.normals[side], ring.normals[(side + 1) % RADIAL_SIDES]) - Math.SQRT1_2) < 1e-7,
          `ring ${index} round octagonal section`);
      }
      const depthSpan = Math.max(...ring.positions.map((position) => position[2]))
        - Math.min(...ring.positions.map((position) => position[2]));
      if (depthSpan > nominalRadius) depthBearingRings++;
    }
    assert.ok(depthBearingRings > allRings.length * 0.6, "most front and rear cords have thickness through the depth axis");
  });

  test(`${family}: smaller physical braided cords cover the complete front and rear panel edges`, () => {
    const nominalRadius = spec.rx * (0.005 / 0.16);
    const border = allRings.filter((ring) => distance(ring.positions[0], ring.center) < nominalRadius * 0.8);
    assert.ok(border.length > 1_200, "both panels have two densely sampled edging strands");
    for (const side of [1, -1]) {
      const panel = border.filter(({ center: [, , z] }) => side * z > spec.depth * 0.3);
      assert.ok(panel.length > 600, "both faces have complete physical edging");
      const sectors = Array(8).fill(0);
      for (const { center: [x, y] } of panel) {
        const untaperedX = x / (1 + spec.taper * y / spec.ry);
        const outlineLevel = (Math.abs(untaperedX / spec.rx) ** spec.power + Math.abs(y / spec.ry) ** spec.power) ** (1 / spec.power);
        assert.ok(outlineLevel > 0.85 && outlineLevel < 1.08, "small cords follow the outer contour rather than crossing the face");
        const angle = Math.atan2(y / spec.ry, x / spec.rx);
        const sector = Math.floor(((angle + Math.PI) / (Math.PI * 2)) * sectors.length) % sectors.length;
        sectors[sector]++;
      }
      assert.ok(sectors.every((count) => count > 25), "physical edging reaches every angular part of each panel");
    }
  });

  test(`${family}: matching front and rear yarn also wraps the physical gusset`, () => {
    const front = allRings.filter(({ center: [, , z] }) => z > spec.depth * 0.3);
    const back = allRings.filter(({ center: [, , z] }) => z < -spec.depth * 0.3);
    assert.ok(front.length > 500 && back.length > 500, "both cloth faces carry actual yarn");
    // Interior face samples exclude the gusset's own staggered rows, which
    // intentionally wrap continuously around the perimeter and through depth.
    const interior = ({ center: [x, y] }) => Math.abs(x) < spec.rx * 0.72 && Math.abs(y) < spec.ry * 0.65;
    const frontInterior = front.filter(interior);
    const key = (center) => center.map((value, axis) => Math.round((axis === 2 ? Math.abs(value) : value) * 1e7)).join(":");
    const rearCenters = new Set(back.filter(interior).map(({ center }) => key(center)));
    const mirrored = frontInterior.filter(({ center }) => rearCenters.has(key(center))).length;
    assert.ok(frontInterior.length > 500, "physical face samples exclude the sidewall");
    assert.ok(mirrored / frontInterior.length > 0.95, "the same physical stitch construction is mirrored on the back");
    const gusset = allRings.filter(({ center: [x, y, z] }) => Math.abs(z) < spec.depth * 0.22
      && (Math.abs(x) > spec.rx * 0.7 || y < -spec.ry * 0.7));
    assert.ok(gusset.length > 100, "visible side/bottom yarn crosses between the two faces");
  });

  test(`${family}: cords preserve family proportions and remain attached to the canonical soft shell`, () => {
    const x = bounds(meshes, 0), y = bounds(meshes, 1), z = bounds(meshes, 2);
    const nominalRadius = spec.rx * (0.005 / 0.16);
    const maxWidth = spec.rx * (1 + Math.abs(spec.taper)) + nominalRadius * 2;
    assert.ok(x.min >= -maxWidth && x.max <= maxWidth, "yarn does not widen the calibrated body");
    assert.ok(x.max - x.min > spec.rx * 1.7, "yarn reaches across the whole body");
    assert.ok(y.max - y.min > spec.ry * 1.6, "yarn reaches the top and bottom");
    assert.ok(y.max < spec.ry + nominalRadius * 2 && y.min > -spec.ry - 0.12, "no disconnected rows above or below the body");
    assert.ok(z.min < -spec.depth * 0.4 && z.max > spec.depth * 0.4, "construction encloses a three-dimensional body");

    const triangles = shellTriangles(makeVariableDepthBody(family));
    const stride = Math.max(1, Math.floor(allRings.length / 240));
    for (let sample = 0; sample < allRings.length; sample += stride) {
      const gap = nearestShellSurface(allRings[sample].center, triangles);
      assert.ok(gap < nominalRadius * 1.7 + 0.01, `cord center ${sample} remains near the actual shell (${gap.toFixed(4)})`);
    }
  });
}

test("stitch choices without physical cord paths deliberately retain the existing surface fallback", () => {
  for (const family of families) for (const stitch of [2, 3]) {
    assert.deepEqual(createCrochetCordMeshes(family, stitch), []);
  }
});

test("herringbone has its own physical cord construction in every family", () => {
  for (const family of families) {
    const classic = createCrochetCordMeshes(family, 0);
    const herringbone = createCrochetCordMeshes(family, 1);
    assert.ok(herringbone.length > 0, `${family} has physical herringbone yarn`);
    assert.notDeepEqual(herringbone[0].positions, classic[0].positions, `${family} herringbone changes the actual path`);
    for (const mesh of herringbone) {
      const count = mesh.positions.length / 3;
      assert.ok(count > 0 && count <= 60_000, `${family} herringbone chunk budget`);
      assert.equal(mesh.normals.length, mesh.positions.length);
      assert.equal(mesh.uvs.length, count * 2);
      assert.ok(mesh.positions.every(Number.isFinite) && mesh.normals.every(Number.isFinite), `${family} finite herringbone`);
      assert.ok(mesh.indices.every((index) => Number.isInteger(index) && index >= 0 && index < count), `${family} valid herringbone elements`);
    }
  }
});
