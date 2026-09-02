import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync("app/bag-builder-engine.tsx", "utf8");
const css = fs.readFileSync("app/bag-builder-engine.css", "utf8");
const bridge = fs.readFileSync("app/exact-live-customizer.tsx", "utf8");
const library = fs.readFileSync("lib/exact-customizer-library.ts", "utf8");
const layout = fs.readFileSync("app/layout.tsx", "utf8");
const parts = Array.from({ length: 6 }, (_, i) => fs.readFileSync(`public/images/configurator/exact-live-v4/sprite-part-${String(i).padStart(2, "0")}.txt`, "utf8"));
const sprite = Buffer.from(parts.join(""), "base64");

test("legacy photographic reference library remains intact as atelier source material", () => {
  assert.equal((library.match(/index:\d+/g) || []).length, 19);
  assert.equal(parts.reduce((n, part) => n + part.length, 0), 29720);
  assert.equal(sprite.length, 22290);
  assert.equal(sprite.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(sprite.subarray(8, 12).toString("ascii"), "WEBP");
});

test("all Bag Builder construction dimensions are active", () => {
  for (const key of ["family", "color", "stitch", "flap", "handles", "hardware", "strap", "accent"]) assert.match(source, new RegExp(`${key}:`));
  assert.match(source, /data-builder-signature/);
  assert.match(source, /Podgląd pozostaje aktywny przez cały czas/);
});

test("layered builder replaces finished-photo selection while preserving the old bridge mount", () => {
  assert.match(bridge, /bag-builder-engine/);
  assert.match(source, /abags-vc-builder-active/);
  assert.match(css, /\.abags-vc-base/);
  assert.match(css, /\.abags-vc-exact-reference/);
  assert.match(css, /display:none!important/);
});

test("project supports save reset and workshop handoff", () => {
  assert.match(source, /abags-bag-builder-v3/);
  assert.match(source, /Zapisz projekt/);
  assert.match(source, /Wyczyść/);
  assert.match(source, /Wyślij projekt do pracowni/);
  assert.match(source, /whatsappHref/);
});

test("layout mounts Bag Builder through the existing customizer bridge", () => {
  assert.match(layout, /ExactLiveCustomizer/);
  assert.match(layout, /bag-builder-engine\.css/);
  assert.match(layout, /<ExactLiveCustomizer \/>/);
  assert.doesNotMatch(layout, /<RealtimeCustomizerPreview \/>/);
  assert.doesNotMatch(layout, /<ExactReferenceLibrary \/>/);
});
