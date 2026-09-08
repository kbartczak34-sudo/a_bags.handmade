import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("lib/abags-photoreal-materials.ts", "utf8");

test("PBR material registry covers the production material families", () => {
  for (const kind of ["cord", "leather", "suede", "satin", "wood", "metal"]) {
    assert.match(source, new RegExp(`kind: \\"${kind}\\"`));
  }
});

test("metal profile is physically metallic and fabric profiles remain non-metallic", () => {
  assert.match(source, /kind: "metal"[\\s\\S]*?metalness: 1/);
  assert.match(source, /kind: "cord"[\\s\\S]*?metalness: 0/);
  assert.match(source, /kind: "leather"[\\s\\S]*?metalness: 0/);
  assert.match(source, /kind: "suede"[\\s\\S]*?metalness: 0/);
});

test("registry exposes Fresnel and studio-environment helpers", () => {
  assert.match(source, /export function schlickFresnel/);
  assert.match(source, /export function studioEnvironmentLobe/);
});

test("PBR profiles include micro-detail and environment calibration controls", () => {
  assert.match(source, /normalScale: 0\./);
  assert.match(source, /microDetail: 0\./);
  assert.match(source, /environmentIntensity: 0\./);
});
