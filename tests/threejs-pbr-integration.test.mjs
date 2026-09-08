import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const registry = fs.readFileSync("lib/abags-three-model-registry.ts", "utf8");
const renderer = fs.readFileSync("app/bag-builder-threejs-pbr.tsx", "utf8");
const assets = fs.readFileSync("lib/abags-three-asset-contract.ts", "utf8");

test("GLB contract declares all physical bag meshes", () => {
  for (const name of ["body", "flap", "handles", "strap", "hardware", "accessories"]) assert.match(registry, new RegExp(`"${name}"`));
});

test("production renderer consumes canonical GLB and texture paths", () => {
  for (const name of ["model", "basecolor", "normal", "roughness", "metallic", "ao"]) assert.match(renderer, new RegExp(`definition\\.asset\\.${name}`));
  assert.match(renderer, /getABagsThreeModelDefinition/);
  assert.match(renderer, /createABagsThreePbrMaterial/);
});

test("renderer is fail-safe when the physical GLB contract is missing", () => {
  assert.match(renderer, /ABAGS_GLTF_MESH_CONTRACT_INVALID/);
  assert.match(renderer, /abagsThreeStatus = "fallback"/);
});

test("asset contract uses the immutable public 3D root", () => {
  assert.match(assets, /ABAGS_3D_ASSET_ROOT = "\/3d\/bags"/);
  assert.match(assets, /model\.glb/);
  assert.match(assets, /basecolor\.webp/);
});
