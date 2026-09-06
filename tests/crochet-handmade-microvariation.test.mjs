import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/bag-builder-crochet-relief-overlay.tsx", import.meta.url), "utf8");

test("handmade crochet relief remains geometry-safe and deterministic", () => {
  assert.match(source, /RELIEF_VERSION = "stitch-depth-v2-handmade"/);
  assert.match(source, /ABAGS_FIDELITY_V4_FAMILY_SPECS\[family\]/);
  assert.match(source, /function deterministicVariation/);
  assert.match(source, /Math\.imul/);
  assert.match(source, /function handmadeOffset/);
  assert.doesNotMatch(source, /Math\.random/);
});

test("all four stitch constructions receive small handmade variation", () => {
  assert.match(source, /function drawClassic/);
  assert.match(source, /const stepX = 25 \* unit/);
  assert.match(source, /const stepY = 21 \* unit/);
  assert.match(source, /function drawHerringbone/);
  assert.match(source, /const stepX = 23 \* unit/);
  assert.match(source, /function drawBasket/);
  assert.match(source, /const cell = 32 \* unit/);
  assert.match(source, /function drawShell/);
  assert.match(source, /const stepX = 35 \* unit/);
  assert.match(source, /fibreGlint/);
});

test("microvariation preserves selected product colour by using neutral relief only", () => {
  assert.match(source, /rgba\(35,24,27,\.27\)/);
  assert.match(source, /rgba\(255,255,255,\.24\)/);
  assert.match(source, /rgba\(255,255,255,\.17\)/);
  assert.doesNotMatch(source, /fillStyle\s*=\s*["']#/);
});

test("handmade relief remains event-driven and mobile-safe", () => {
  assert.match(source, /requestAnimationFrame/);
  assert.match(source, /ResizeObserver/);
  assert.match(source, /abags:fidelity3d-transform/);
  assert.match(source, /Math\.max\(0\.72, Math\.min\(2\.7, Math\.min\(width, height\) \/ 720\)\)/);
  assert.doesNotMatch(source, /setInterval|getImageData|putImageData|readPixels/);
});
