import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [stack, finish] = await Promise.all([
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-flap-realism.tsx", import.meta.url), "utf8"),
]);

test("flap realism stays downstream of calibrated rigid finishing without replacing geometry", () => {
  assert.match(stack, /<BagBuilderRigidMaterialFinish\s*\/>[\s\S]*<BagBuilderFlapRealism\s*\/>/);
  assert.match(finish, /FINISH_VERSION = "flap-realism-v1-calibrated-surface"/);
  assert.match(finish, /ABAGS_FIDELITY_V4_FAMILY_SPECS\[family\]/);
  assert.match(finish, /stage\.dataset\.abagsFinal3d !== "ready"/);
  assert.match(finish, /stage\.dataset\.abagsPhotoTrue === "active"/);
});

test("flap profile uses the exact calibrated contour and adds only apparent thickness", () => {
  assert.match(finish, /const centerY = spec\.flapY \?\? 0\.29/);
  assert.match(finish, /const rx = 0\.80 \* spec\.flapScale\[0\]/);
  assert.match(finish, /const ry = 0\.36 \* spec\.flapScale\[1\]/);
  assert.match(finish, /spec\.depth \/ 2 \+ 0\.145/);
  assert.match(finish, /function drawFlapSurfaceProfile/);
  assert.match(finish, /Apparent thickness only/);
  assert.match(finish, /createRadialGradient/);
  assert.match(finish, /createLinearGradient/);
  assert.doesNotMatch(finish, /\.abags-fidelity3d-canvas\s*\{[^}]*transform:/s);
});

test("snap has a full metallic response instead of a flat dot", () => {
  assert.match(finish, /function hardwarePalette/);
  assert.match(finish, /function drawSnapFinish/);
  assert.match(finish, /metal\.addColorStop\(0, palette\.hot\)/);
  assert.match(finish, /metal\.addColorStop\(0\.52, palette\.mid\)/);
  assert.match(finish, /metal\.addColorStop\(0\.79, palette\.shadow\)/);
  assert.match(finish, /context\.ellipse\(snap\.x \+ 0\.9 \* unit/);
  assert.match(finish, /context\.arc\(snap\.x - radius \* 0\.28/);
});

test("crochet, leather and suede keep distinct deterministic surface cues", () => {
  assert.match(finish, /const crochet = flap === "crochet"/);
  assert.match(finish, /const suede = flap === "suede-burgundy"/);
  assert.match(finish, /rgba\(255,255,255,\.22\)/);
  assert.match(finish, /rgba\(255,238,241,\.14\)/);
  assert.match(finish, /rgba\(255,248,239,\.20\)/);
  assert.doesNotMatch(finish, /Math\.random/);
});

test("flap realism is event-driven, mobile bounded and gesture transparent", () => {
  assert.match(finish, /requestAnimationFrame/);
  assert.match(finish, /ResizeObserver/);
  assert.match(finish, /abags:fidelity3d-transform/);
  assert.match(finish, /dprCap = window\.innerWidth <= 620 \? 1\.5 : 2/);
  assert.match(finish, /pointer-events:none!important/);
  assert.match(finish, /touch-action:none!important/);
  assert.match(finish, /aria-hidden="true"/);
  assert.doesNotMatch(finish, /setInterval|getImageData|putImageData|readPixels/);
});
