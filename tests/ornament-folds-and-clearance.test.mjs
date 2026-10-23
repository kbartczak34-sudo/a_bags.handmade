import test from 'node:test';
import assert from 'node:assert/strict';
import { geometry as g, specs } from './helpers/fidelity-geometry.mjs';

test('bow loops return behind the front fabric and have rounded, broad outer folds', () => {
  for (const compact of [false, true]) for (const side of [-1, 1]) {
    for (const u of [.15, .25, .35]) {
      const front = g.foldedRibbonLoop(u, 0, side, compact), back = g.foldedRibbonLoop(1 - u, 0, side, compact);
      assert.ok(Math.abs(front[0] - back[0]) < .001);
      assert.ok(front[2] - back[2] > .07, 'return fabric must fold in depth, not form an open planar oval');
    }
    const top = g.foldedRibbonLoop(.5, 1, side, compact), bottom = g.foldedRibbonLoop(.5, -1, side, compact), center = g.foldedRibbonLoop(.5, 0, side, compact);
    assert.ok(top[1] - bottom[1] > .16);
    assert.ok(Math.abs(center[0]) > Math.abs(top[0]) + .03, 'outer hem must roll around a rounded fold');
  }
});

test('scarf tails hang at unequal lengths, twist across their width and remain separate from the compact bow', () => {
  for (const side of [-1, 1]) {
    const root = g.foldedRibbonTail(0, 0, side, false), scarf = g.foldedRibbonTail(1, 1, side, false), bow = g.foldedRibbonTail(1, 1, side, true);
    assert.ok(Math.abs(root[0]) < .035 && Math.abs(root[1]) < .04 && root[2] < .08, 'tail root must enter the tied band');
    assert.ok(root[1] - scarf[1] > .60);
    assert.ok(scarf[1] < bow[1] - .4);
    const twists = [.2, .3, .4, .6, .7].map(u => Math.abs(g.foldedRibbonTail(u, 1, side, false)[2] - g.foldedRibbonTail(u, -1, side, false)[2]));
    assert.ok(Math.max(...twists) > .04, 'each tail must turn across its width');
    assert.ok(Math.max(...twists) - Math.min(...twists) > .025, 'the turn must vary along the falling fabric');
  }
  const tip = side => Math.min(...[-1, 1].map(v => g.foldedRibbonTail(1, v, side, false)[1]));
  assert.ok(Math.abs(tip(-1) - tip(1)) > .1);
  for (const side of [-1, 1]) assert.ok(Math.abs(g.foldedRibbonTail(1, -1, side, false)[1] - g.foldedRibbonTail(1, 1, side, false)[1]) > .2, 'scarf has a diagonal pointed end');
});

test('the gathered knot closes around the loop and tail roots as a fabric band', () => {
  for (const v of [-1, 0, 1]) {
    assert.ok(Math.hypot(...g.foldedRibbonKnot(0, v).map((n, i) => n - g.foldedRibbonKnot(1, v)[i])) < 1e-8);
  }
  const front = g.foldedRibbonKnot(.25, 0), rear = g.foldedRibbonKnot(.75, 0);
  assert.ok(front[2] - rear[2] > .05);
  assert.ok(g.foldedRibbonKnot(0, 0)[1] > .03 && g.foldedRibbonKnot(.5, 0)[1] < -.04);
});

test('the handle wrap follows the actual canted wood frame and clears its round section', () => {
  for (const family of Object.keys(specs)) {
    const m = g.woodHandleMatrix(family, g.woodHandleDepthPlanes(family)[1]);
    const angle = Math.PI - .16, center = [.46 * Math.cos(angle), .42 * Math.sin(angle), 0];
    const radial = [Math.cos(angle) / .46, Math.sin(angle) / .42, 0], length = Math.hypot(...radial);
    for (let step = 0; step <= 24; step++) for (const v of [-1, 0, 1]) {
      const p = g.woodHandleRibbonPoint(family, step / 24, v), delta = p.map((n, i) => n - m[12 + i]);
      const local = [0, 4, 8].map(c => delta.reduce((sum, n, i) => sum + n * m[c + i], 0) / (m[c] ** 2 + m[c + 1] ** 2 + m[c + 2] ** 2));
      const d = local.map((n, i) => n - center[i]), alongRadius = d.reduce((sum, n, i) => sum + n * radial[i] / length, 0);
      const distance = Math.hypot(alongRadius, d[2]);
      assert.ok(distance > .047 && distance < .054, `${family}: wrap intersects or floats away from the .042 wood tube`);
    }
  }
});

test('tassel has a filled bundle, varied falling lengths and fine fibres connected to every cut end', () => {
  const strands = g.tasselFringeStrands();
  assert.ok(strands.length >= 30 && strands.length <= 48);
  const ends = strands.map(s => s.path.at(-1));
  assert.ok(Math.max(...ends.map(p => p[1])) - Math.min(...ends.map(p => p[1])) > .04);
  assert.ok(strands.some(s => Math.hypot(s.path[0][0], s.path[0][2] - .07) < .015));
  for (const { path, frays } of strands) {
    assert.ok(path.every((p, i) => !i || p[1] < path[i - 1][1]));
    assert.equal(frays.length, 3);
    for (const fray of frays) {
      assert.ok(fray[0].every((n, i) => n === path.at(-1)[i]));
      const length = Math.hypot(...fray.at(-1).map((n, i) => n - fray[0][i]));
      assert.ok(length > .010 && length < .025);
    }
  }
});

test('ornaments drape over the selected physical flap, including crochet crowns', () => {
  const cases = [['bucket', 'none', ['leather-black', 'suede-burgundy', 'crochet']], ['mini', 'wood-light', ['leather-cognac', 'crochet']], ['round', 'none', ['crochet']]];
  for (const [family, handles, flaps] of cases) for (const flap of flaps) for (const accent of ['bow', 'scarf', 'tassel', 'charm']) {
    const config = { family, handles, flap, accent }, surface = g.closedFlapSurface(family, flap === 'crochet');
    const { parts } = g.makeOrnamentGeometry(config), radius = specs[family].rx * 5 / 160;
    for (const { mesh } of parts) for (let i = 0; i < mesh.positions.length; i += 24) {
      const [x, y, z] = mesh.positions.slice(i, i + 3), seat = surface.sample(x, y);
      if (!seat) continue;
      assert.ok(z - seat.z - (flap === 'crochet' ? radius * 1.75 : 0) > .0008, `${family}/${flap}/${accent}: ornament penetrates the flap`);
    }
  }
});

test('a changed flap rebuilds ornament seating while recolouring the same rigid flap reuses buffers', () => {
  let allocated = 0, deleted = 0;
  const gl = { ARRAY_BUFFER: 1, ELEMENT_ARRAY_BUFFER: 2, STATIC_DRAW: 3, createBuffer: () => ({ id: ++allocated }), bindBuffer() {}, bufferData() {}, deleteBuffer() { deleted++; } };
  const renderer = { gl, meshes: {} }, config = { family: 'bucket', handles: 'none', accent: 'scarf', flap: 'none' };
  g.ensureOrnamentMeshes(renderer, config);
  const first = allocated;
  g.ensureOrnamentMeshes(renderer, { ...config, flap: 'leather-black' });
  assert.equal(deleted, first);
  const second = allocated;
  g.ensureOrnamentMeshes(renderer, { ...config, flap: 'leather-cognac', color: '#087E81' });
  assert.equal(allocated, second);
  g.ensureOrnamentMeshes(renderer, { ...config, flap: 'crochet' });
  assert.equal(deleted, second);
});

test('a spatial hem retains a circular section when its tangent is parallel to the preferred guide', () => {
  const mesh = { positions: [], normals: [], uvs: [], indices: [] };
  g.appendCord(mesh, [[0,0,0],[0,0,.1],[0,0,.2]], .002, () => [0,0,1], () => true, 8);
  for (let i = 0; i < mesh.normals.length; i += 3) assert.ok(Math.abs(Math.hypot(...mesh.normals.slice(i, i + 3)) - 1) < 1e-7);
  assert.ok(Math.max(...mesh.positions.filter((_, i) => i % 3 === 0)) > .0019);
});
