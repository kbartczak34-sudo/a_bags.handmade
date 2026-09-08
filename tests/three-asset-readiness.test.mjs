import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const registry = fs.readFileSync("lib/abags-three-model-registry.ts", "utf8");
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

test("Three.js readiness gate requires the GLB and every production PBR asset", () => {
  for (const key of assetKeys) assert.match(registry, new RegExp(`\\"${key}\\"`));
  assert.match(gate, /return readiness\.complete && readiness\.missing\.length === 0/);
  assert.match(gate, /must remain on the proven fallback/);
});
