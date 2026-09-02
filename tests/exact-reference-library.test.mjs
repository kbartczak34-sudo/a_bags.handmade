import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync("app/exact-live-customizer.tsx", "utf8");
const css = fs.readFileSync("app/exact-live-customizer.css", "utf8");
const library = fs.readFileSync("lib/exact-customizer-library.ts", "utf8");
const layout = fs.readFileSync("app/layout.tsx", "utf8");
const parts = Array.from({ length: 6 }, (_, i) => fs.readFileSync(`public/images/configurator/exact-live-v4/sprite-part-${String(i).padStart(2, "0")}.txt`, "utf8"));
const sprite = Buffer.from(parts.join(""), "base64");

test("photographic customizer library is complete", () => {
  assert.equal((library.match(/index:\d+/g) || []).length, 19);
  assert.equal(parts.reduce((n, part) => n + part.length, 0), 29720);
  assert.equal(sprite.length, 22290);
  assert.equal(sprite.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(sprite.subarray(8, 12).toString("ascii"), "WEBP");
});

test("all personalization dimensions are active", () => {
  for (const key of ["family", "color", "stitch", "flap", "handles", "hardware", "strap", "accent"]) assert.match(source, new RegExp(`\\[\\"${key}\\"`));
  assert.match(source, /matches\(ref, filters/);
  assert.match(source, /Podgląd w czasie rzeczywistym/);
});

test("exact preview replaces synthetic rendering", () => {
  assert.match(source, /has-exact-reference/);
  assert.match(css, /\.abags-vc-preview\.has-exact-reference \.abags-vc-base/);
  assert.match(css, /\.abags-vc-preview\.has-exact-reference \.abags-vc-layer/);
  assert.match(css, /abags-vc-exact-live-active \.abags-vc-controls/);
});

test("project supports save compare and workshop handoff", () => {
  assert.match(source, /abags-exact-customizer-v1/);
  assert.match(source, /Zapisz projekt/);
  assert.match(source, /Porównaj z modelem bazowym/);
  assert.match(source, /Wyślij projekt do pracowni/);
  assert.match(source, /whatsappHref/);
});

test("layout mounts the exact renderer", () => {
  assert.match(layout, /ExactLiveCustomizer/);
  assert.match(layout, /exact-live-customizer\.css/);
  assert.match(layout, /<ExactLiveCustomizer \/>/);
  assert.doesNotMatch(layout, /<RealtimeCustomizerPreview \/>/);
  assert.doesNotMatch(layout, /<ExactReferenceLibrary \/>/);
});
