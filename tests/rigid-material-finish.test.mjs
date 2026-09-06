import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [stack, finish] = await Promise.all([
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-rigid-material-finish.tsx", import.meta.url), "utf8"),
]);

test("natural material finish stays downstream of calibrated body and accessory layers", () => {
  assert.match(stack, /<BagBuilderAccessoryMaterialFinish\s*\/>[\s\S]*<BagBuilderRigidMaterialFinish\s*\/>/);
  assert.match(finish, /FINISH_VERSION = "rigid-natural-material-v2-flap-depth"/);
  assert.match(finish, /ABAGS_FIDELITY_V4_FAMILY_SPECS\[family\]/);
  assert.match(finish, /stage\.dataset\.abagsFinal3d !== "ready"/);
});

test("wood handle finish mirrors calibrated tubeArc centreline without changing geometry", () => {
  assert.match(finish, /0\.67 \* Math\.cos\(angle\) \* spec\.handleScale\[0\]/);
  assert.match(finish, /0\.50 \* Math\.sin\(angle\) \* spec\.handleScale\[1\]/);
  assert.match(finish, /spec\.depth \/ 2 \+ 0\.055/);
  assert.match(finish, /function drawWoodHandle/);
  assert.match(finish, /rgba\(111,75,36,\.22\)/);
});

test("crochet flap receives neutral contact depth without recolouring the verified WebGL material", () => {
  assert.match(finish, /if \(flap === "none"\) return/);
  assert.match(finish, /const crochet = flap === "crochet"/);
  assert.match(finish, /function drawFlapContactDepth/);
  assert.match(finish, /function drawCrochetFlapCrown/);
  assert.match(finish, /createRadialGradient/);
  assert.match(finish, /rgba\(30,22,25,\.22\)/);
  assert.match(finish, /rgba\(255,255,255,\.17\)/);
  assert.match(finish, /rgba\(28,19,23,\.14\)/);
  assert.match(finish, /selected cord colour and stitch[\s\S]*verified WebGL material/);
  assert.doesNotMatch(finish, /crochet[\s\S]{0,240}fillStyle\s*=\s*["']#/);
});

test("all flap materials keep the same calibrated contour and only add surface lighting", () => {
  assert.match(finish, /const centerY = spec\.flapY \?\? 0\.29/);
  assert.match(finish, /const rx = 0\.80 \* spec\.flapScale\[0\]/);
  assert.match(finish, /const ry = 0\.36 \* spec\.flapScale\[1\]/);
  assert.match(finish, /spec\.depth \/ 2 \+ 0\.145/);
  assert.match(finish, /drawFlapContactDepth\(context, path, unit, crochet, suede\)/);
  assert.doesNotMatch(finish, /scale\([^\n]*flap/);
});

test("leather and suede flaps keep distinct deterministic surface cues", () => {
  assert.match(finish, /flap === "suede-burgundy"/);
  assert.match(finish, /createLinearGradient/);
  assert.match(finish, /rgba\(255,247,238,\.18\)/);
  assert.match(finish, /rgba\(34,12,21,\.045\)/);
  assert.doesNotMatch(finish, /Math\.random/);
});

test("finish remains event-driven and touch-transparent on mobile", () => {
  assert.match(finish, /requestAnimationFrame/);
  assert.match(finish, /ResizeObserver/);
  assert.match(finish, /dprCap = window\.innerWidth <= 620 \? 1\.5 : 2/);
  assert.match(finish, /pointer-events:none!important/);
  assert.match(finish, /touch-action:none!important/);
  assert.match(finish, /aria-hidden="true"/);
  assert.doesNotMatch(finish, /setInterval|getImageData|putImageData|readPixels/);
});
