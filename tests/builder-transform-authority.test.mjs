import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const webglPath = new URL("../app/bag-builder-final-webgl3d.tsx", import.meta.url);
const overlayPath = new URL("../app/bag-builder-accessory-fidelity-overlay.tsx", import.meta.url);

test("Fidelity V4 owns the customer transform and publishes it to accessory layers", async () => {
  const [webgl, overlay] = await Promise.all([
    readFile(webglPath, "utf8"),
    readFile(overlayPath, "utf8"),
  ]);

  assert.match(webgl, /abags:fidelity3d-transform/);
  assert.match(webgl, /abagsFidelity3dRotationX/);
  assert.match(webgl, /abagsFidelity3dRotationY/);
  assert.match(webgl, /abagsFidelity3dZoom/);

  assert.match(overlay, /abags:fidelity3d-transform/);
  assert.doesNotMatch(overlay, /const pointers = new Map/);
  assert.doesNotMatch(overlay, /boundCanvas\.addEventListener\("pointer/);
  assert.doesNotMatch(overlay, /stage\.addEventListener\("click", onClick/);
});
