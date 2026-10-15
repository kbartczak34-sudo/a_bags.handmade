import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { Matrix4, PerspectiveCamera, Vector3 } from "three";

const source = await readFile(new URL("../lib/abags-fidelity-projection.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { projectFidelityPoint } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

test("accessory coordinates match an independent 3D camera across views, zoom and viewport shapes", () => {
  const points = [[0, 0, 0], [-0.94, 0.55, 0.295], [0.94, 0.55, 0.295], [0, 0.05, 0.376], [0.72, 1.23, 0.55]];
  for (const [width, height] of [[390, 246], [245.5, 500.25], [1440, 900]]) {
    const camera = new PerspectiveCamera(180 / 5.3, width / height, 0.1, 100);
    camera.position.set(0, 0.02, 5);
    camera.updateMatrixWorld();
    for (const rotation of [{ x: -0.12, y: -0.62 }, { x: -0.02, y: 0 }, { x: 0.4, y: 1.27 }]) {
      for (const zoom of [0.34, 0.92, 1.45]) {
        const root = new Matrix4().makeScale(zoom, zoom, zoom)
          .multiply(new Matrix4().makeRotationX(rotation.x))
          .multiply(new Matrix4().makeRotationY(rotation.y));
        for (const point of points) {
          const expected = new Vector3(...point).applyMatrix4(root).project(camera);
          const actual = projectFidelityPoint(point, width, height, rotation, zoom);
          assert.ok(actual);
          assert.ok(Math.abs(actual.x - (expected.x + 1) * width / 2) < 1e-6);
          assert.ok(Math.abs(actual.y - (1 - expected.y) * height / 2) < 1e-6);
        }
      }
    }
  }
});

test("accessories behind the camera are not painted", () => {
  assert.equal(projectFidelityPoint([0, 0, 6], 390, 246, { x: 0, y: 0 }, 1), null);
});
