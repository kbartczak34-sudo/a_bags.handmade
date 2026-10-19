import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const overlay = await readFile(new URL("../app/bag-builder-accessory-fidelity-overlay.tsx", import.meta.url), "utf8");

test("small-screen charm retains a real visible pendant on the 3D canvas", () => {
  assert.match(overlay, /const compact = width < 480;/);
  assert.match(overlay, /Math\.max\(compact \? 4\.1 : 2\.5, 4\.2 \* scale\)/);
  assert.match(overlay, /drawCharm\(front\.ctx, config, front\.width, front\.height, rotation, zoom\)/);
});
