import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { geometry, specs } from "./helpers/fidelity-geometry.mjs";

const renderer = await readFile(new URL("../app/bag-builder-fidelity3d.tsx", import.meta.url), "utf8");

test("wooden rings attach to the seam used by the visible shell", () => {
  assert.match(renderer, /const depthPlanes = woodHandleDepthPlanes\(renderFamily\)/);
  assert.match(renderer, /for \(const z of depthPlanes\)/);
  assert.doesNotMatch(renderer, /const depthPlanes = \[-profile\.topDepth/);
});

test("both handle mounting planes meet real rim vertices in every family", () => {
  for (const family of Object.keys(specs)) {
    const planes = geometry.woodHandleDepthPlanes(family);
    const seam = geometry.openingPath(family);
    assert.ok(planes[0] < 0 && planes[1] > 0);
    assert.equal(planes[0], -planes[1]);
    for (const plane of planes) {
      const contacts = seam.filter((point) => Math.abs(point[2] - plane) < 1e-7);
      assert.ok(contacts.length > 0, `${family}: handle must touch a real rim vertex`);
      assert.ok(contacts.some((point) => point[1] > specs[family].bodyY + specs[family].ry * .97));
    }
  }
});


test("wooden handle ends are seated at the real stitched rim and both arches cant inward", () => {
  for (const family of Object.keys(specs)) {
    const seamTopY = Math.max(...geometry.openingPath(family).map((point) => point[1]));
    const mountingY = geometry.woodHandleMountHeight(family);
    assert.ok(mountingY <= seamTopY, `${family}: arch feet must not float above the rim`);
    assert.ok(seamTopY - mountingY < 0.025, `${family}: arch feet stay in direct rim contact`);
  }
  assert.match(renderer, /\[z < 0 \? 0\.40 : -0\.40, 0, 0\]/);
});
