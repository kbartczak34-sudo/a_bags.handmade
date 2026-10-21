import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { geometry as g, specs } from "./helpers/fidelity-geometry.mjs";

const families = Object.keys(specs);
const stitches = ["classic", "herringbone", "basket", "shell"];
const source = await readFile(new URL("../lib/abags-accessory-fidelity.ts", import.meta.url), "utf8");
const context = { exports: {} };
runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
const { readFidelityAccessoryAnchor, fidelityTasselFringe } = context.exports;

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

test("thin fitted flap shells clear every real stitch crown and remain close to the body", () => {
  for (const family of families) {
    const radius = specs[family].rx * 5 / 160;
    for (const crochet of [false, true]) {
      const surface = g.closedFlapSurface(family, crochet);
      let closest = Infinity, checked = 0;
      for (const stitch of stitches) {
        const body = g.makeCrochetPanel(family, stitch);
        for (let i = 0; i < body.positions.length; i += 3) {
          const face = surface.sample(body.positions[i], body.positions[i + 1] + specs[family].bodyY);
          if (!face) continue;
          const gap = face.z - surface.thickness - body.positions[i + 2];
          assert.ok(gap > .001, `${family}/${stitch}: backing intersects a cord crown (${gap})`);
          closest = Math.min(closest, gap);
          checked++;
        }
      }
      assert.ok(checked > 1000);
      assert.ok(closest < radius, `${family}: flap must sit against the body`);
      assert.ok(surface.thickness <= radius * .75, `${family}: no thick extruded slab`);
      assert.ok(surface.mesh.positions.every(Number.isFinite));
      const vertices = surface.mesh.positions.length / 3;
      assert.ok(vertices < 65536);
      assert.ok(surface.mesh.indices.every((i) => i >= 0 && i < vertices));
    }
  }
});

test("leather snap follows the fitted face normal and seats against its actual surface", () => {
  for (const family of ["round", "mini"]) {
    const renderer = { gl: gpu(), meshes: {} };
    g.ensureClosedFlapShell(renderer, family, false);
    const lockY = specs[family].ringY - .32;
    const face = g.closedFlapSurface(family, false).sample(0, lockY);
    assert.ok(face);
    const pose = g.matrix([0, lockY, renderer.flapLockZ], [1, 1, 1], renderer.flapLockRotation);
    const normal = [pose[8], pose[9], pose[10]];
    assert.ok(Math.hypot(...normal.map((n, axis) => n - face.normal[axis])) < 1e-6);
    const clearance = (renderer.flapLockZ - face.z) * face.normal[2] - .021;
    assert.ok(clearance > .001 && clearance < .004, `${family}: snap back is seated (${clearance})`);
  }
});

test("fitted shells reuse GPU buffers until the family or construction changes", () => {
  const gl = gpu(), renderer = { gl, meshes: {} };
  g.ensureClosedFlapShell(renderer, "mini", false);
  const first = renderer.meshes.flapShell;
  g.ensureClosedFlapShell(renderer, "mini", false);
  assert.equal(renderer.meshes.flapShell, first);
  assert.equal(gl.state.allocated, 4);
  g.ensureClosedFlapShell(renderer, "mini", true);
  assert.equal(gl.state.allocated, 8);
  assert.equal(gl.state.deleted, 4);
  g.ensureClosedFlapShell(renderer, "round", true);
  assert.equal(gl.state.deleted, 8);
  assert.equal(Object.keys(renderer.meshes).length, 1);
});

test("strap and chain endpoint geometry shares the same depth plane as its metal rings", () => {
  for (const family of families) for (const make of [g.familyShoulderStrapMesh, g.familyShoulderChainMesh]) {
    const mesh = make(family);
    const verticesPerEnd = make === g.familyShoulderStrapMesh ? 12 : 8 * 10;
    const stride = make === g.familyShoulderStrapMesh ? 13 : 9 * 11;
    const links = specs[family].chain[2];
    for (const side of [-1, 1]) {
      const first = side < 0 ? 0 : make === g.familyShoulderStrapMesh ? 84 * stride : (links - 1) * stride;
      const center = [0, 0, 0];
      if (make === g.familyShoulderStrapMesh) {
        for (let j = 0; j < 12; j++) for (let axis = 0; axis < 3; axis++) center[axis] += mesh.positions[(first + j) * 3 + axis] / verticesPerEnd;
      } else {
        // Ignore duplicated UV seam samples when locating a toroidal link center.
        for (let r = 0; r < 8; r++) for (let k = 0; k < 10; k++) for (let axis = 0; axis < 3; axis++) center[axis] += mesh.positions[(first + r * 11 + k) * 3 + axis] / verticesPerEnd;
      }
      const ring = g.strapHardwarePosition(family, side);
      const pose = g.shoulderStrapMatrix(family);
      const endpoint = center.map((n, axis) => n + pose[12 + axis]);
      assert.ok(Math.abs(endpoint[0] - ring[0]) < 1e-6, `${family}: shared lateral endpoint`);
      assert.ok(Math.abs(endpoint[2] - ring[2]) < 1e-6, `${family}: shared depth plane`);
      assert.ok(Math.abs(endpoint[1] - ring[1] - .06) < 1e-6, `${family}: strap meets the top of the ring`);
    }
  }
});

test("ornament anchors touch the body and a wooden-handle scarf touches the actual ring", () => {
  for (const family of families) {
    for (const accent of ["tassel", "scarf", "charm"]) {
      const anchor = g.fidelityAccessoryAnchor({ family, accent, handles: "none" });
      const seat = g.crochetPanelPoint(family, anchor[0], anchor[1] - specs[family].bodyY);
      const clearance = anchor[2] - seat[2];
      assert.ok(clearance > 0 && clearance < .08, `${family}/${accent}: no detached depth anchor`);
    }
  }
  for (const family of ["tote", "mini"]) {
    const anchor = g.fidelityAccessoryAnchor({ family, accent: "scarf", handles: "wood-light" });
    const model = g.woodHandleMatrix(family, g.woodHandleDepthPlanes(family)[1]);
    const delta = anchor.map((n, axis) => n - model[12 + axis]);
    const local = [0, 4, 8].map((column) => delta.reduce((sum, n, axis) => sum + n * model[column + axis], 0) / [0, 1, 2].reduce((sum, axis) => sum + model[column + axis] ** 2, 0));
    assert.ok(Math.abs((local[0] / .46) ** 2 + (local[1] / .42) ** 2 - 1) < 1e-6);
    assert.ok(local[0] < 0 && local[1] > 0 && local[2] > .042 && local[2] < .065);
  }
  assert.equal(g.fidelityAccessoryAnchor({ family: "mini", accent: "none", handles: "none" }), null);
});

test("sewn strap loops reach the real cord panel and wrap the bottom of both metal rings", () => {
  for (const family of families) {
    const panels = stitches.map((stitch) => [stitch, g.makeCrochetPanel(family, stitch)]);
    for (const side of [-1, 1]) {
      const { paths, radius } = g.strapBindingPaths(family, side);
      const ring = g.strapHardwarePosition(family, side);
      for (const path of paths) {
        assert.ok(path.some((p) => p[1] > ring[1] - .13 * .88 && Math.abs(p[0] - ring[0]) < .001));
        for (const [stitch, panel] of panels) {
          for (const foot of [path[0], path.at(-2)]) {
            let nearest = Infinity;
            for (let i = 0; i < panel.positions.length; i += 3) {
              nearest = Math.min(nearest, Math.hypot(foot[0] - panel.positions[i], foot[1] - specs[family].bodyY - panel.positions[i + 1], foot[2] - panel.positions[i + 2]));
            }
            assert.ok(nearest < radius * 4, `${family}/${stitch}: sewn tab must meet real body cord (${nearest})`);
          }
        }
      }
    }
  }
});

test("strap binding geometry remains valid and reuses one cached GPU mesh", () => {
  for (const family of families) {
    const mesh = g.makeStrapBinding(family);
    const vertices = mesh.positions.length / 3;
    assert.ok(vertices > 500 && vertices < 65536);
    assert.ok(mesh.positions.every(Number.isFinite));
    assert.ok(mesh.indices.every((i) => i >= 0 && i < vertices));
    assert.equal(mesh.positions.length, mesh.normals.length);
  }
  const gl = gpu(), renderer = { gl, meshes: {} };
  g.ensureStrapBinding(renderer, "round");
  g.ensureStrapBinding(renderer, "round");
  assert.equal(gl.state.allocated, 4);
  g.ensureStrapBinding(renderer, "mini");
  assert.equal(gl.state.allocated, 8);
  assert.equal(gl.state.deleted, 4);
});


test("metal D-rings contain a straight stitched crossbar and true curved shoulders", () => {
  const ring = g.makeDHardwareRing();
  const vertices = ring.positions.length / 3;
  assert.ok(vertices > 500 && vertices < 65536);
  assert.equal(ring.positions.length, ring.normals.length);
  assert.equal(ring.uvs.length, vertices * 2);
  assert.ok(ring.positions.every(Number.isFinite));
  assert.ok(ring.indices.every((i) => Number.isInteger(i) && i >= 0 && i < vertices));
  // A real straight bar crosses the entire ring beneath the curved crown.
  const crossbar = [];
  const crown = [];
  for (let i = 0; i < ring.positions.length; i += 3) {
    const x = ring.positions[i], y = ring.positions[i + 1];
    if (Math.abs(y + .13) < .028) crossbar.push(x);
    if (y > .10) crown.push(x);
  }
  assert.ok(crossbar.length > 100);
  assert.ok(Math.min(...crossbar) < -.12 && Math.max(...crossbar) > .12);
  assert.ok(crown.length > 70 && Math.min(...crown) < 0 && Math.max(...crown) > 0);
  for (let i = 0; i < ring.normals.length; i += 3) {
    assert.ok(Math.abs(Math.hypot(...ring.normals.slice(i, i + 3)) - 1) < 1e-5);
  }
});

test("lobster hook and sprung gate are volumetric, not screen-space hardware drawings", () => {
  const clasp = g.makeLobsterClaspMesh();
  const vertices = clasp.positions.length / 3;
  assert.ok(vertices > 350 && vertices < 65536);
  assert.equal(clasp.normals.length, clasp.positions.length);
  assert.equal(clasp.uvs.length, vertices * 2);
  assert.ok(clasp.indices.every((i) => Number.isInteger(i) && i >= 0 && i < vertices));
  assert.ok(clasp.positions.every(Number.isFinite));
  assert.ok(Math.min(...clasp.positions.filter((_, i) => i % 3 === 2)) < -.009);
  assert.ok(Math.max(...clasp.positions.filter((_, i) => i % 3 === 2)) > .009);
  for (const family of families) for (const side of [-1, 1]) {
    const anchor = g.strapHardwarePosition(family, side);
    const claspPoint = g.strapClaspPosition(family, side);
    assert.equal(claspPoint[0], anchor[0]);
    assert.equal(claspPoint[2], anchor[2]);
    assert.ok(Math.abs(claspPoint[1] - anchor[1] - .08) < 1e-7);
    // Physical hook overlaps both the top of the D-ring and the strap tip.
    assert.ok(claspPoint[1] + .042 > anchor[1] + .06);
    assert.ok(claspPoint[1] - .042 < anchor[1] + .13);
  }
});

test("accessory metadata ignores stale configurations and malformed coordinates", () => {
  const current = { builderSignature: "mini|pink|basket|none|wood-light|chain|gold|scarf", abagsFidelityAccessoryAnchor: "[-0.4,0.7,0.5]" };
  assert.equal(readFidelityAccessoryAnchor(current), undefined);
  current.abagsFidelityAccessorySignature = current.builderSignature;
  assert.equal(JSON.stringify(readFidelityAccessoryAnchor(current)), "[-0.4,0.7,0.5]");
  for (const raw of ["", "{", "null", "[1,2]", "[1,2,3,4]", "[1,2,1e999]", '[1,2,"3"]']) {
    assert.equal(readFidelityAccessoryAnchor({ ...current, abagsFidelityAccessoryAnchor: raw }), undefined);
  }
  assert.equal(readFidelityAccessoryAnchor({ ...current, builderSignature: "changed" }), undefined);
});

test("tassel fringe fans out in width and depth while remaining tied at one narrow neck", () => {
  const anchor = [.65, .25, .38];
  const paths = Array.from({ length: 9 }, (_, i) => fidelityTasselFringe(anchor, i));
  const extent = (axis, at) => Math.max(...paths.map((path) => path[at][axis])) - Math.min(...paths.map((path) => path[at][axis]));
  assert.ok(extent(0, 2) > .16, "visible fan in front view");
  assert.ok(extent(2, 2) > .08, "visible volume in side view");
  assert.ok(extent(0, 0) < .035 && extent(2, 0) < .02, "narrow tied neck");
  for (const path of paths) {
    assert.ok(path.flat().every(Number.isFinite));
    assert.ok(path[0][1] > path[1][1] && path[1][1] > path[2][1]);
    assert.ok(path.every((p) => p[2] >= anchor[2]), "fringes remain outside the front panel");
  }
});
