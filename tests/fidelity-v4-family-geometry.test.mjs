import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const renderer = await readFile(new URL("../app/bag-builder-final-webgl3d.tsx", import.meta.url), "utf8");
const specs = await readFile(new URL("../lib/abags-fidelity-v4-family-spec.ts", import.meta.url), "utf8");

test("Fidelity V4 renderer consumes one calibrated family geometry contract", () => {
  assert.match(renderer, /ABAGS_FIDELITY_V4_FAMILY_SPECS/);
  assert.match(renderer, /ABAGS_FIDELITY_V4_RENDERER_VERSION/);
  assert.match(renderer, /data-abags-final-webgl="v4"/);
  assert.match(renderer, /const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS\[family\]/);
  assert.match(renderer, /const metrics = familyMetrics\(config\.family\)/);
  assert.doesNotMatch(renderer, /const RENDERER_VERSION = "abags-fidelity-v3"/);
});

test("Kuferek is flatter and firmer than the V3 pillow silhouette", () => {
  assert.match(specs, /tote:[\s\S]*?rx: 1\.04,[\s\S]*?ry: 0\.72,[\s\S]*?power: 7\.2,[\s\S]*?depth: 0\.31/);
});

test("Z klapą and Strukturalna have independent calibrated construction", () => {
  assert.match(specs, /bucket:[\s\S]*?label: "Z klapą"[\s\S]*?taper: 0\.075,[\s\S]*?flapY: 0\.27/);
  assert.match(specs, /mini:[\s\S]*?label: "Strukturalna \/ mini"[\s\S]*?power: 8\.0,[\s\S]*?depth: 0\.27/);
});

test("technical family keys remain persistence-compatible", () => {
  for (const family of ["tote", "round", "bucket", "mini"]) {
    assert.match(specs, new RegExp(`\\b${family}: \\{`));
  }
});