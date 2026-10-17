import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { textileNormalMatrix, textileUvFrame } from "../lib/abags-textile-surface.ts";

const close = (actual, expected) => actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 1e-6, `${actual} != ${expected}`));
const triangle = (positions, normals, uvs = [0, 0, 1, 0, 0, 1]) => ({ positions, normals: [...normals, ...normals, ...normals], uvs, indices: [0, 1, 2] });

test("UV derivatives retain physical stitch scale on front and side panels", () => {
  const front = textileUvFrame(triangle([0, 0, 0, 2, 0, 0, 0, 3, 0], [0, 0, 1]));
  close(front.tangent.slice(0, 3), [2, 0, 0]);
  close(front.bitangent.slice(0, 3), [0, 3, 0]);
  const side = textileUvFrame(triangle([0, 0, 0, 0, 2, 0, 0, 0, -3], [-1, 0, 0]));
  close(side.tangent.slice(0, 3), [0, 2, 0]);
  close(side.bitangent.slice(0, 3), [0, 0, -3]);
});

test("mirrored UVs retain their handedness instead of reversing a back-panel bump", () => {
  const frame = textileUvFrame(triangle([0, 0, 0, 2, 0, 0, 0, 3, 0], [0, 0, -1], [1, 0, 0, 0, 1, 1]));
  close(frame.tangent.slice(0, 3), [-2, 0, 0]);
  close(frame.bitangent.slice(0, 3), [0, 3, 0]);
});

test("collapsed UVs and zero-area triangles have finite fallback frames", () => {
  for (const positions of [[0, 0, 0, 1, 0, 0, 0, 1, 0], new Array(9).fill(0)]) {
    const frame = textileUvFrame(triangle(positions, [0, 0, 1], new Array(6).fill(0)));
    assert.ok([...frame.tangent, ...frame.bitangent].every(Number.isFinite));
    close(frame.tangent.slice(0, 3), [1, 0, 0]);
    close(frame.bitangent.slice(0, 3), [0, 1, 0]);
  }
});

test("normal matrix stays perpendicular to a rotated, nonuniformly scaled accessory", () => {
  const angle = .63, c = Math.cos(angle), s = Math.sin(angle);
  const model = new Float32Array([2 * c, 0, -2 * s, 0, 0, 3, 0, 0, 4 * s, 0, 4 * c, 0, 0, 0, 0, 1]);
  const normalMatrix = textileNormalMatrix(model);
  const transform = (matrix, v, stride) => [0, 1, 2].map(row => matrix[row] * v[0] + matrix[stride + row] * v[1] + matrix[stride * 2 + row] * v[2]);
  const tangent = transform(model, [1, -1, 0], 4);
  const normal = transform(normalMatrix, [1, 1, 1], 3);
  assert.ok(Math.abs(tangent.reduce((sum, value, axis) => sum + value * normal[axis], 0)) < 1e-6);
  close(transform(normalMatrix, [0, 1, 0], 3), [0, 1 / 3, 0]);
});

test("cord lighting matches displaced geometry across zoom, mirrored UVs and accessory scales", () => {
  const dot = (a, b) => a.reduce((sum, value, axis) => sum + value * b[axis], 0);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = (v) => v.map(value => value / Math.hypot(...v));
  const transform = (matrix, v, stride) => [0, 1, 2].map(row => matrix[row] * v[0] + matrix[stride + row] * v[1] + matrix[stride * 2 + row] * v[2]);
  const relief = .005, slope = [50, -37.5];
  const heightDerivative = slope.map(value => value * relief * .48);
  const panels = [
    triangle([0, 0, 0, 2, 0, 0, 0, 3, 0], [0, 0, 1]),
    triangle([0, 0, 0, 2, 0, 0, 0, 3, 0], [0, 0, -1], [1, 0, 0, 0, 1, 1]),
    triangle([0, 0, 0, 0, 2, 0, 0, 0, -3], [-1, 0, 0]),
  ];
  for (const panel of panels) {
    const frame = textileUvFrame(panel);
    const localNormal = panel.normals.slice(0, 3);
    for (const accessoryScale of [[1, 1, 1], [.76, .58, 1], [-.76, .58, 1]]) {
      let firstNormal;
      for (const zoom of [.34, .92, 1.45]) {
        const angle = .63, c = Math.cos(angle), s = Math.sin(angle);
        const [sx, sy, sz] = accessoryScale.map(value => value * zoom);
        const model = new Float32Array([sx * c, 0, -sx * s, 0, 0, sy, 0, 0, sz * s, 0, sz * c, 0, 0, 0, 0, 1]);
        const t = transform(model, frame.tangent.slice(0, 3), 4);
        const b = transform(model, frame.bitangent.slice(0, 3), 4);
        const n = unit(transform(textileNormalMatrix(model), localNormal, 3));
        const displacement = transform(model, localNormal, 4);
        const reciprocalU = cross(b, n), reciprocalV = cross(n, t);
        const determinant = dot(t, reciprocalU);
        const gradient = reciprocalU.map((value, axis) => (value * slope[0] + reciprocalV[axis] * slope[1]) / determinant);
        const worldReliefScale = dot(displacement, n);
        const litNormal = unit(n.map((value, axis) => value - gradient[axis] * relief * worldReliefScale * .48));

        // Independently differentiate the displaced geometry, then transform it.
        const displacedT = transform(model, frame.tangent.slice(0, 3).map((value, axis) => value + localNormal[axis] * heightDerivative[0]), 4);
        const displacedB = transform(model, frame.bitangent.slice(0, 3).map((value, axis) => value + localNormal[axis] * heightDerivative[1]), 4);
        let geometricNormal = unit(cross(displacedT, displacedB));
        if (dot(geometricNormal, n) < 0) geometricNormal = geometricNormal.map(value => -value);
        close(litNormal, geometricNormal);
        if (firstNormal) close(litNormal, firstNormal);
        else firstNormal = litNormal;
      }
    }
  }
});

test("geometry and lighting use one cord height field without screen-space fabric repainting", () => {
  const renderer = readFileSync(new URL("../app/bag-builder-fidelity3d.tsx", import.meta.url), "utf8");
  assert.equal(renderer.split("${ABAGS_CROCHET_HEIGHT_GLSL}").length - 1, 2);
  assert.match(renderer, /height=crochetHeight\(aUv,uStitch\)\*uRelief/);
  assert.match(renderer, /cord=crochetHeight\(vUv,uStitch\)/);
  assert.match(renderer, /cross\(vBitangent,n\)/);
  assert.match(renderer, /vReliefScale\s*=\s*dot\(mat3\(uModel\)\*aNormal,vNormal\)/);
  assert.match(renderer, /gradient\*uRelief\*vReliefScale\*\.48/);
  assert.doesNotMatch(renderer, /vFaceWeight|sideShade/);
});
