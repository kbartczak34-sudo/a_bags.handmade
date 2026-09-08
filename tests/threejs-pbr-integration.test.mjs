import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const registry = fs.readFileSync("lib/abags-three-model-registry.ts", "utf8");
const renderer = fs.readFileSync("app/bag-builder-threejs-pbr.tsx", "utf8");
const assets = fs.readFileSync("lib/abags-three-asset-contract.ts", "utf8");

test("GLB contract declares all physical bag meshes", () => {
  for (const name of ["body", "flap", "handles", "strap", "hardware", "accessories"]) {
    assert.match(registry, new RegExp(`"${name}"`));
  }
});

test("production renderer consumes the canonical GLB asset contract", () => {
  assert.match(renderer, /getABagsThreeModelDefinition/);
  assert.match(renderer, /definition\.asset\.model/);
  assert.match(renderer, /definition\.asset\.textures\.basecolor/);
  assert.match(renderer, /definition\.asset\.textures\.normal/);
  assert.match(renderer, /definition\.asset\.textures\.roughness/);
  assert.match(renderer, /definition\.asset\.textures\.metallic/);
  assert.match(renderer, /definition\.asset\.textures\.ao/);
});

test("renderer is fail-safe when the physical GLB contract is missing", () => {
  assert.match(renderer, /ABAGS_GLTF_MESH_CONTRACT_INVALID/);
  assert.match(renderer, /host\.dataset\.abagsThreeStatus = "fallback"/);
});

test("asset contract uses the immutable public 3D root", () => {
  assert.match(assets, /ABAGS_3D_ASSET_ROOT = "\/3d\/bags"/);
  assert.match(assets, /model\.glb/);
  assert.match(assets, /basecolor\.webp/);
});
