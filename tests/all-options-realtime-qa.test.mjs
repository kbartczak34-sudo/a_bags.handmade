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
  assert.match(smoke, /all eight Bag Builder decisions visibly redraw verified WebGL/);
});

test("desktop and mobile scenarios exercise all eight builder decisions", () => {
  for (const key of ["family", "color", "stitch", "flap", "handles", "strap", "hardware", "accent"]) {
    const matches = qa.match(new RegExp(`\\[\\"${key}\\",`, "g")) || [];
    assert.ok(matches.length >= 2, `${key} must be exercised on both desktop and mobile`);
  }
});

test("option acceptance requires both synchronized signatures and changed WebGL pixels", () => {
  assert.match(qa, /stage\.dataset\.abagsFidelity3dFrame===stage\.dataset\.builderSignature/);
  assert.match(qa, /afterState\.signature === beforeState\.signature/);
  assert.match(qa, /afterPixels\.hash === beforePixels\.hash/);
  assert.match(qa, /gl\.readPixels/);
});

test("desktop disables touch emulation without invalid zero touch points", () => {
  assert.match(qa, /if \(viewport\.mobile\) \{[\s\S]*maxTouchPoints: 5[\s\S]*\} else \{[\s\S]*enabled: false[\s\S]*\}/);
  assert.doesNotMatch(qa, /maxTouchPoints:\s*viewport\.mobile\s*\?\s*5\s*:\s*0/);
  assert.doesNotMatch(qa, /maxTouchPoints:\s*0/);
});

test("mobile Mini keeps incompatible wooden handles unavailable", () => {
  assert.match(qa, /incompatible: \[\["handles", "wood-light"\], \["handles", "wood-dark"\]\]/);
  assert.match(qa, /incompatible .* incorrectly selectable/);
});
