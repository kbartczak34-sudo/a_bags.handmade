import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [stack, rim, css] = await Promise.all([
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-agata-top-rim.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-agata-top-rim.css", import.meta.url), "utf8"),
]);

test("photo-calibrated handmade top rim is mounted inside the realtime 3D stack", () => {
  assert.match(stack, /bag-builder-agata-top-rim\.css/);
  assert.match(stack, /<BagBuilderAgataTopRim\s*\/>/);
  assert.match(css, /z-index:8!important/);
});

test("top rim derives from the locked Fidelity V4 body and never changes the silhouette", () => {
  assert.match(rim, /ABAGS_FIDELITY_V4_FAMILY_SPECS/);
  assert.match(rim, /spec\.rx/);
  assert.match(rim, /spec\.ry/);
  assert.match(rim, /spec\.depth/);
  assert.match(rim, /context\.clip\(body\.path\)/);
  assert.doesNotMatch(rim, /style\.transform/);
});

test("Agata rim contains two interlocked cord rows with localized seam depth", () => {
  assert.match(rim, /for \(let row = 0; row < 2; row \+= 1\)/);
  assert.match(rim, /loopPath/);
  assert.match(rim, /crossingPath/);
  assert.match(rim, /Deep seam immediately beneath the handmade rim/);
  assert.match(rim, /bezierCurveTo/);
  assert.match(rim, /quadraticCurveTo/);
});

test("rim remains deterministic, Photo-True safe and event driven", () => {
  assert.match(rim, /abagsPhotoTrue === "active"/);
  assert.match(rim, /requestAnimationFrame/);
  assert.match(rim, /ResizeObserver/);
  assert.doesNotMatch(rim, /Math\.random/);
  assert.doesNotMatch(rim, /setInterval/);
  assert.doesNotMatch(rim, /readPixels/);
  assert.match(css, /data-abags-photo-true="active"/);
});

test("old generic relief is nearly retired when the photo-calibrated cord renderer is active", () => {
  assert.match(css, /data-abags-agata-cord-webgl="agata-cord-webgl-v1-photo-calibrated"/);
  assert.match(css, /abags-crochet-relief-surface/);
  assert.match(css, /opacity:\.06!important/);
  assert.match(css, /opacity:\.04!important/);
});
