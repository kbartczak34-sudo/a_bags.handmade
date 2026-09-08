import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const root = "public/3d/bags";
test("no partial Three.js asset directories can ship", () => {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    for (const file of ["model.glb","textures/basecolor.webp","textures/normal.webp","textures/roughness.webp","textures/metallic.webp","textures/ao.webp"]) {
      assert.ok(fs.existsSync(`${root}/${entry.name}/${file}`), `${entry.name}: missing ${file}`);
    }
  }
});
