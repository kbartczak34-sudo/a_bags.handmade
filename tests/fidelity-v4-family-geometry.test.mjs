import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const renderer = await readFile(new URL("../app/bag-builder-final-webgl3d.tsx", import.meta.url), "utf8");
const specs = await readFile(new URL("../lib/abags-fidelity-v4-family-spec.ts", import.meta.url), "utf8");

test("Fidelity V4 renderer consumes one calibrated family geometry contract", () => {
  assert.match(renderer, /ABAGS_FIDELITY_V4_FAMILY_SPECS/);
  assert.match(renderer, /ABAGS_FIDELITY_V4_RENDERER_VERSION/);
  assert.match(renderer, /familyContour\(family\).*?ABAGS_FIDELITY_V4_FAMILY_SPECS\[family\]/s);
  assert.match(renderer, /function familyContour/);
  assert.match(renderer, /function superellipseContour/);
  assert.match(renderer, /function volumetricBodyMesh/);
});

test("each current family has a deliberately different bag silhouette and depth", () => {
  assert.match(specs, /tote:[\s\S]*?rx: 1\.03,[\s\S]*?ry: 0\.86,[\s\S]*?power: 5\.6,[\s\S]*?depth: 0\.48/);
  assert.match(specs, /round:[\s\S]*?rx: 0\.88,[\s\S]*?ry: 0\.90,[\s\S]*?power: 2\.15,[\s\S]*?depth: 0\.46/);
  assert.match(specs, /bucket:[\s\S]*?rx: 0\.92,[\s\S]*?ry: 0\.87,[\s\S]*?power: 5\.0,[\s\S]*?depth: 0\.54/);
  assert.match(specs, /mini:[\s\S]*?rx: 0\.79,[\s\S]*?ry: 0\.67,[\s\S]*?power: 6\.2,[\s\S]*?depth: 0\.40/);
});

test("all family references point to real Agata source variants", () => {
  for (const reference of ["pastel-tote-wood-bow", "cream-round-taupe-flap", "cream-burgundy-flap", "small-multicolor-chain"]) {
    assert.match(specs, new RegExp(reference));
  }
});
