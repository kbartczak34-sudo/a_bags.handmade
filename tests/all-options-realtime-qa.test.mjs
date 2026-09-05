import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const qa = readFileSync("scripts/smoke-customizer-all-options.mjs", "utf8");
const smoke = readFileSync("scripts/smoke-production.sh", "utf8");

test("all-options production browser gate has valid Node syntax", () => {
  const check = spawnSync(process.execPath, ["--check", "scripts/smoke-customizer-all-options.mjs"], { encoding: "utf8" });
  assert.equal(check.status, 0, check.stderr || check.stdout);
});

test("production smoke blocks on the all-options realtime browser gate", () => {
  assert.match(smoke, /node scripts\/smoke-customizer-all-options\.mjs/);
  assert.match(smoke, /all eight Bag Builder decisions visibly redraw the verified realtime composition/);
});

test("desktop and mobile scenarios exercise all eight builder decisions", () => {
  for (const key of ["family", "color", "stitch", "flap", "handles", "strap", "hardware", "accent"]) {
    const matches = qa.match(new RegExp(`\\[\\"${key}\\",`, "g")) || [];
    assert.ok(matches.length >= 2, `${key} must be exercised on both desktop and mobile`);
  }
});

test("option acceptance requires synchronized signatures and changed composited pixels", () => {
  assert.match(qa, /stage\.dataset\.abagsFidelity3dFrame===stage\.dataset\.builderSignature/);
  assert.match(qa, /afterState\.signature === beforeState\.signature/);
  assert.match(qa, /afterPixels\.hash === beforePixels\.hash/);
  assert.match(qa, /gl\.readPixels/);
  assert.match(qa, /accessory\.getContext\('2d'\)/);
  assert.match(qa, /overlay\.getImageData/);
  assert.match(qa, /overlayOpaque/);
});

test("production QA requires the calibrated accessory canvas and captures final desktop/mobile evidence", () => {
  assert.match(qa, /abags-accessory-fidelity-canvas/);
  assert.match(qa, /accessoryVersion/);
  assert.match(qa, /finalPixels\.overlayOpaque <= 0/);
  assert.match(qa, /accessory-\$\{label\.toLowerCase\(\)\}-final\.png/);
  assert.match(qa, /Page\.captureScreenshot/);
});

test("desktop disables touch emulation without invalid zero touch points", () => {
  assert.match(qa, /if \(viewport\.mobile\) \{[\s\S]*maxTouchPoints: 5[\s\S]*\} else \{[\s\S]*enabled: false[\s\S]*\}/);
  assert.doesNotMatch(qa, /maxTouchPoints:\s*viewport\.mobile\s*\?\s*5\s*:\s*0/);
  assert.doesNotMatch(qa, /maxTouchPoints:\s*0/);
});

test("desktop and mobile exercise only Mini construction choices backed by Agata references", () => {
  assert.ok((qa.match(/\["family", "mini"\]/g) || []).length >= 2);
  assert.ok((qa.match(/\["handles", "wood-light"\]/g) || []).length >= 2);
  assert.match(qa, /\["flap", "crochet"\]/);
  assert.match(qa, /\["strap", "woven"\]/);
  assert.match(qa, /\["strap", "chain"\]/);
  assert.match(qa, /\["accent", "tassel"\]/);
  assert.match(qa, /\["accent", "charm"\]/);
});

test("production QA rejects Mini construction choices not present in Agata evidence", () => {
  assert.match(qa, /\["handles", "wood-dark"\]/);
  assert.match(qa, /\["handles", "crochet"\]/);
  assert.match(qa, /\["flap", "leather-cognac"\]/);
  assert.match(qa, /\["flap", "suede-burgundy"\]/);
  assert.match(qa, /\["strap", "leather"\]/);
  assert.match(qa, /\["accent", "scarf"\]/);
  assert.match(qa, /bounded to real Agata component evidence/);
  assert.match(qa, /incompatible .* incorrectly selectable/);
});