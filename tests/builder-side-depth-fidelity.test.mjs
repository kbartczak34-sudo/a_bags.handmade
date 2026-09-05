import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [overlay, fidelity] = await Promise.all([
  readFile(new URL("../app/bag-builder-accessory-fidelity-overlay.tsx", import.meta.url), "utf8"),
  readFile(new URL("../lib/abags-accessory-fidelity.ts", import.meta.url), "utf8"),
]);

test("flexible strap keeps calibrated attachment depth while gaining physical side-view depth", () => {
  assert.match(fidelity, /strapDepthBowRatio:\s*0\.78/);
  assert.match(fidelity, /strapDepthBowMin:\s*0\.20/);
  assert.match(overlay, /const baseZ = spec\.depth \/ 2 \+ 0\.055/);
  assert.match(overlay, /const depthBow = Math\.max\(ABAGS_ACCESSORY_VISUAL\.strapDepthBowMin, spec\.depth \* ABAGS_ACCESSORY_VISUAL\.strapDepthBowRatio\)/);
  assert.match(overlay, /baseZ \+ depthBow \* Math\.sin\(angle\)/);
});

test("depth bow is zero at both hardware endpoints and maximal only between them", () => {
  const endpointContribution = (t) => Math.sin(Math.PI - t * Math.PI);
  assert.ok(Math.abs(endpointContribution(0)) < 1e-12);
  assert.ok(Math.abs(endpointContribution(1)) < 1e-12);
  assert.ok(endpointContribution(0.5) > 0.999999);
  assert.match(overlay, /const t = index \/ 48/);
  assert.match(overlay, /const angle = Math\.PI - t \* Math\.PI/);
});

test("side-depth refinement does not change the calibrated body or hardware anchors", () => {
  assert.match(overlay, /spec\.sideAnchor \* Math\.cos\(angle\)/);
  assert.match(overlay, /spec\.ringY \+ archHeight \* Math\.sin\(angle\)/);
  assert.doesNotMatch(overlay, /sideAnchor\s*[+\-]=/);
  assert.doesNotMatch(overlay, /ringY\s*[+\-]=/);
});
