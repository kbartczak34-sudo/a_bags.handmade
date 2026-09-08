import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = "public/3d/bags";
const contract = fs.readFileSync("lib/abags-three-asset-contract.ts", "utf8");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");

const requiredMaps = ["basecolor.webp", "normal.webp", "roughness.webp", "metallic.webp", "ao.webp"];
const requiredMeshes = ["body", "flap", "handles", "strap", "hardware", "accessories"];

test("Three.js asset contract defines immutable model-root and all required PBR maps", () => {
  assert.match(contract, /ABAGS_3D_ASSET_ROOT = [\"']\/3d\/bags[\"']/);
  for (const map of requiredMaps) assert.match(contract, new RegExp(map.replace(".", "\\.")));
  for (const mesh of requiredMeshes) assert.match(readme, new RegExp(`\\b${mesh}\\b`));
});

test("production 3D asset directory contains no incomplete model folders", () => {
  const entries = fs.readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  for (const entry of entries) {
    const modelRoot = path.join(root, entry.name);
    assert.ok(fs.existsSync(path.join(modelRoot, "model.glb")), `${entry.name}: missing model.glb`);
    for (const map of requiredMaps) {
      assert.ok(fs.existsSync(path.join(modelRoot, "textures", map)), `${entry.name}: missing ${map}`);
    }
  }
});
