import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = "public/3d/bags";
const required = ["model.glb", "textures/basecolor.webp", "textures/normal.webp", "textures/roughness.webp", "textures/metallic.webp", "textures/ao.webp"];

test("every committed Three.js model directory is complete", () => {
  const dirs = fs.readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  assert.ok(dirs.length >= 0);
  for (const dir of dirs) for (const file of required) assert.ok(fs.existsSync(`${root}/${dir.name}/${file}`), `${dir.name}: missing ${file}`);
});
