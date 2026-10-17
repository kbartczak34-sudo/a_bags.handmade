import assert from "node:assert/strict";
import test from "node:test";
import { Matrix4, OrthographicCamera, Vector3 } from "three";
import { cordShadowMatrix } from "../lib/abags-cord-shadow.ts";

test("cord shadow matrix matches an independent orthographic light camera", () => {
  const direction = new Vector3(-.42, .86, .92).normalize();
  const camera = new OrthographicCamera(-3, 3, 3, -3, .1, 12);
  camera.position.copy(direction).multiplyScalar(6);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const expected = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const actual = cordShadowMatrix();
  for (let index = 0; index < 16; index++) {
    assert.ok(Math.abs(actual[index] - expected.elements[index]) < 1e-6, `column-major element ${index}`);
  }
});

test("world points toward the light have smaller shadow depth while the bag fits the light frustum", () => {
  const matrix = new Matrix4().fromArray(cordShadowMatrix());
  const direction = new Vector3(-.42, .86, .92).normalize();
  const origin = new Vector3().applyMatrix4(matrix);
  const nearerLight = direction.clone().applyMatrix4(matrix);
  assert.ok(nearerLight.z < origin.z, "nearer blocker wins the depth comparison");
  assert.ok(Math.abs(nearerLight.x - origin.x) < 1e-6);
  assert.ok(Math.abs(nearerLight.y - origin.y) < 1e-6);
  for (const x of [-1.5, 1.5]) for (const y of [-1.5, 1.5]) for (const z of [-.8, .8]) {
    const projected = new Vector3(x, y, z).applyMatrix4(matrix);
    assert.ok(Math.max(Math.abs(projected.x), Math.abs(projected.y), Math.abs(projected.z)) < 1,
      "body and handle envelope remains inside the shadow map");
  }
});
