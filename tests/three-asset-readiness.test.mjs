import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const registry = fs.readFileSync("lib/abags-three-model-registry.ts", "utf8");
const contract = fs.readFileSync("lib/abags-three-asset-contract.ts", "utf8");
const gate = fs.readFileSync("lib/abags-three-asset-readiness.ts", "utf8");

const modelIds = [
  "abags-tote-v1",
  "abags-round-v1",
  "abags-bucket-v1",
  "abags-mini-v1",
];

const assetKeys = ["model", "basecolor", "normal", "roughness", "metallic", "ao"];

 test("Three.js model registry maps every supported family to an immutable model id", () => {
  for (const id of modelIds) assert.match(registry, new RegExp(id));
  assert.match(registry, /getABagsThreeModelId\(family: string\): string \| null/);
});

test("Three.js asset contract contains the complete GLB + PBR set", () => {
  for (const key of assetKeys) assert.match(contract, new RegExp(`\\"${key}\\"`));
  assert.match(contract, /model\.glb/);
  assert.match(contract, /basecolor\.webp/);
  assert.match(contract, /normal\.webp/);
  assert.match(contract, /roughness\.webp/);
  assert.match(contract, /metallic\.webp/);
  assert.match(contract, /ao\.webp/);
});

test("Three.js readiness gate never treats an incomplete asset set as production-ready", () => {
  assert.match(gate, /return readiness\.complete && readiness\.missing\.length === 0/);
  assert.match(gate, /must remain on the proven fallback/);
});

test("Required production meshes remain explicitly separated", () => {
  for (const mesh of ["body", "flap", "handles", "strap", "hardware", "accessories"]) {
    assert.match(registry, new RegExp(`\\"${mesh}\\"`));
  }
});
