import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [renderer, surfaceCss] = await Promise.all([
  readFile(new URL("../app/bag-builder-final-webgl3d.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-lifelike-surface.css", import.meta.url), "utf8"),
]);

test("Fidelity v4 keeps calibrated geometry while separating physical material response", () => {
  assert.match(renderer, /ABAGS_FIDELITY_V4_FAMILY_SPECS\[family\]/);
  assert.match(renderer, /data-abags-material-model="polyester-leather-metal-wood-suede-v3-agata-curved-shading"/);
  assert.match(renderer, /uMaterial<\.5/);
  assert.match(renderer, /uMaterial<1\.5/);
  assert.match(renderer, /uMaterial<2\.5/);
  assert.match(renderer, /uMaterial<3\.5/);
  assert.match(renderer, /hm=config\.handles==="crochet"\?0:3/);
  assert.match(renderer, /fm=config\.flap==="crochet"\?0:config\.flap==="suede-burgundy"\?4:1/);
  assert.match(renderer, /rough=/);
  assert.match(renderer, /metallic=/);
  assert.match(renderer, /spec=/);
  assert.match(renderer, /sheen=/);
});

test("studio contact shadow stays behind product and follows customer view without deforming the mesh", () => {
  assert.match(renderer, /data-abags-pro3d-view=\{view\}/);
  assert.match(surfaceCss, /\.abags-fidelity3d-layer::before/);
  assert.match(surfaceCss, /data-abags-pro3d-view="side"/);
  assert.match(surfaceCss, /data-abags-pro3d-view="three"/);
  assert.match(surfaceCss, /z-index:0/);
  assert.match(surfaceCss, /pointer-events:none/);
  assert.doesNotMatch(surfaceCss, /\.abags-fidelity3d-canvas\s*\{[^}]*transform:/s);
});
