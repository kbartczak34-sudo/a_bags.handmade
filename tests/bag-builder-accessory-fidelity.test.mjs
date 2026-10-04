import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [overlay, fidelity, stack, fidelity3d] = await Promise.all([
  readFile(new URL("../app/bag-builder-accessory-fidelity-overlay.tsx", import.meta.url), "utf8"),
  readFile(new URL("../lib/abags-accessory-fidelity.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-fidelity3d.tsx", import.meta.url), "utf8"),
]);

test("accessory refinement remains mounted without competing with V18", () => {
  assert.match(stack, /<BagBuilderAccessoryFidelityOverlay\s*\/>/);
  assert.doesNotMatch(stack, /<BagBuilderFinalWebGL3D\s*\/>/);
});

test("accessory calibration remains deterministic", () => {
  assert.match(fidelity, /ABAGS_ACCESSORY_FIDELITY_VERSION/);
  assert.match(overlay, /data-abags-accessory-fidelity/);
  assert.doesNotMatch(overlay, /Math\.random/);
});


test("accessory overlay camera follows the canonical WebGL transform", () => {
  assert.match(fidelity3d, /abagsFidelity3dRotationX/);
  assert.match(fidelity3d, /abagsFidelity3dRotationY/);
  assert.match(fidelity3d, /abagsFidelity3dZoom/);
  assert.match(fidelity3d, /abags:fidelity3d-transform/);
  assert.match(overlay, /data-abags-fidelity3d-rotation-x/);
  assert.match(overlay, /data-abags-fidelity3d-rotation-y/);
  assert.match(overlay, /data-abags-fidelity3d-zoom/);
  assert.match(overlay, /abags:fidelity3d-transform/);
});


test("accessory projection matches WebGL matrix order, view and FOV", () => {
    assert.match(overlay, /const DEFAULT_ROTATION: Rotation = \\{ x: -0\\.12, y: -0\\.62 \\};/);
  assert.match(overlay, /const DEFAULT_ZOOM = 0\.72/);
  assert.match(overlay, /WebGL matrix multiplication applies rotY first, then rotX/);
  assert.match(overlay, /z -= 5\.0/);
  assert.match(overlay, /Math\.PI \/ 5\.3/);
  assert.doesNotMatch(overlay, /cameraZ = narrow/);
  assert.doesNotMatch(overlay, /fit = narrow/);
});
