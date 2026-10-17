import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [renderer, v3, v4] = await Promise.all([
  readFile(new URL("../app/bag-builder-fidelity3d.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-reference-layout-v3.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-reference-v4.tsx", import.meta.url), "utf8"),
]);

test("mobile step changes target the canonical live stage shared by V3 and V4", () => {
  assert.match(v3, /data-abags-live-stage="true"/);
  assert.match(v4, /function activeCustomerStage\(dialog: HTMLElement\)/);
  assert.match(v4, /const stage = dialog \? activeCustomerStage\(dialog\) : null/);
  assert.match(v4, /const stage = activeCustomerStage\(dialog\)/);
});

test("visible polyester cord relief is genuine tessellated geometry", () => {
  const match = renderer.match(/const faceBands = (\d+);/);
  assert.ok(match);
  assert.ok(Number(match[1]) >= 48);
  assert.match(renderer, /addFabricFace\(frontFace, 1\)/);
  assert.match(renderer, /addFabricFace\(backFace, -1\)/);
});

test("yarn reflects light in the model frame and crossings occlude naturally", () => {
  assert.match(renderer, /varying vec3 vNormal,vWorld,vTangent,vBitangent;/);
  assert.match(renderer, /vTangent=mat3\(uModel\)\*aTangent/);
  assert.match(renderer, /n=normalize\(n-gradient\*uRelief/);
  assert.match(renderer, /cordOcclusion=mix\(1\.0,mix\(\.72,1\.0/);
  assert.match(renderer, /base\*\(sky\+1\.12\*ndl\*shadow\+\.30\*fillLight\)\*cordOcclusion/);
});
