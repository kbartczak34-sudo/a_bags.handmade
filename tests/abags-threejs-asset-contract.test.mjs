import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("lib/abags-threejs-asset-contract.ts", "utf8");

test("Three.js production contract declares all six semantic meshes", () => {
  for (const mesh of ["body", "flap", "handles", "strap", "hardware", "accessories"]) {
    assert.match(source, new RegExp(`\\"${mesh}\\"`));
  }
});

test("Three.js asset contract uses canonical GLB and PBR texture filenames", () => {
  for (const file of ["model.glb", "basecolor.webp", "normal.webp", "roughness.webp", "metallic.webp", "ao.webp"]) {
    assert.match(source, new RegExp(file.replace(".", "\\.")));
  }
});

test("asset paths are rooted in public 3d bag model directories", () => {
  assert.match(source, /`\\/3d\\/bags\\\/${safeId}`/);
  assert.match(source, /encodeURIComponent/);
});

test("manifest validation requires every semantic mesh and texture map", () => {
  assert.match(source, /requiredMeshes\.includes\(mesh\)/);
  assert.match(source, /for \(const key of \[\"basecolor\", \"normal\", \"roughness\", \"metallic\", \"ao\"\]/);
});
