import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [stack, rim, css] = await Promise.all([
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-agata-top-rim.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-agata-top-rim.css", import.meta.url), "utf8"),
]);

test("Top Rim V2 is mounted above Opening Depth and inside the realtime 3D stack", () => {
  assert.match(stack, /bag-builder-agata-top-rim\.css/);
  assert.match(stack, /<BagBuilderOpeningDepth\s*\/>[\s\S]*<BagBuilderAgataTopRim\s*\/>/);
  assert.match(stack, /<BagBuilderAgataTopRim\s*\/>/);
  assert.match(rim, /RIM_VERSION = "agata-handmade-top-rim-v2-corner-depth-seated"/);
  assert.match(css, /z-index:8!important/);
});

test("top rim still derives from locked Fidelity V4 geometry and cannot enlarge the silhouette", () => {
  assert.match(rim, /ABAGS_FIDELITY_V4_FAMILY_SPECS/);
  assert.match(rim, /spec\.rx/);
  assert.match(rim, /spec\.ry/);
  assert.match(rim, /spec\.depth/);
  assert.match(rim, /context\.clip\(body\.path\)/);
  assert.match(rim, /this depth cue cannot alter the outer silhouette/);
  assert.doesNotMatch(rim, /style\.transform/);
});

test("Top Rim V2 turns into sidewall depth instead of staying on one flat front plane", () => {
  assert.match(rim, /const normalizedX = Math\.max\(-1, Math\.min\(1, centerX \/ Math\.max\(span, 0\.001\)\)\)/);
  assert.match(rim, /const edgeTurn = Math\.pow\(Math\.min\(1, Math\.abs\(normalizedX\)\), 1\.65\)/);
  assert.match(rim, /rowZ = baseZ - edgeTurn \* spec\.depth \* 0\.055 \+ handmadeZ/);
  assert.match(rim, /const nearSideBias = 1 \+ yaw \* normalizedX \* 0\.075/);
  assert.match(rim, /Receding Z at both ends makes the front rim turn naturally into the sidewall/);
});

test("rim uses two handmade interlocked rows with per-loop seating instead of a flat dark strip", () => {
  assert.match(rim, /for \(let row = 0; row < 2; row \+= 1\)/);
  assert.match(rim, /loopPath/);
  assert.match(rim, /crossingPath/);
  assert.match(rim, /function drawContactPocket/);
  assert.match(rim, /localized loop-seat shadows below replace the old full-width dark strip/);
  assert.match(rim, /span \* 0\.72/);
  assert.match(rim, /rgba\(19,12,15,\.14\)/);
  assert.match(rim, /bezierCurveTo/);
  assert.match(rim, /quadraticCurveTo/);
});

test("polyester rim response has cord body, directional crown and fine filament glint", () => {
  assert.match(rim, /lineWidth = Math\.max\(1\.45, 6\.10 \* unit\)/);
  assert.match(rim, /lineWidth = Math\.max\(1\.30, 4\.92 \* unit\)/);
  assert.match(rim, /setLineDash\(\[1\.15 \* unit, 2\.35 \* unit\]\)/);
  assert.match(rim, /Fine deterministic filament glint/);
  assert.match(css, /opacity:\.98/);
  assert.match(css, /@media \(max-width:620px\)[\s\S]*opacity:\.95/);
});

test("rim remains deterministic, Photo-True safe and event driven", () => {
  assert.match(rim, /function deterministicJitter/);
  assert.match(rim, /abagsPhotoTrue === "active"/);
  assert.match(rim, /requestAnimationFrame/);
  assert.match(rim, /ResizeObserver/);
  assert.doesNotMatch(rim, /Math\.random/);
  assert.doesNotMatch(rim, /setInterval/);
  assert.doesNotMatch(rim, /readPixels|getImageData|putImageData/);
  assert.match(css, /data-abags-photo-true="active"/);
});

test("old generic relief remains nearly retired when the photo-calibrated cord renderer is active", () => {
  assert.match(css, /data-abags-agata-cord-webgl="agata-cord-webgl-v1-photo-calibrated"/);
  assert.match(css, /abags-crochet-relief-surface/);
  assert.match(css, /opacity:\.06!important/);
  assert.match(css, /opacity:\.04!important/);
});
