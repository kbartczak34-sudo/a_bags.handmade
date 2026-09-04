import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [customizer, css, photoGate] = await Promise.all([
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-customer-cleanroom.css", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-photo-true-gate.tsx", import.meta.url), "utf8"),
]);

test("customer clean-room styles load after the final realtime 3D visibility contract", () => {
  const final3d = customizer.indexOf('import "./bag-builder-final3d-promotion.css"');
  const cleanroom = customizer.indexOf('import "./bag-builder-customer-cleanroom.css"');
  assert.ok(final3d >= 0 && cleanroom > final3d);
});

test("customer builder hides finished-product inspiration and family photography", () => {
  assert.match(css, /\.abags-ref-inspirations/);
  assert.match(css, /\.abags-ref-family-photo/);
  assert.match(css, /display:none!important/);
  assert.match(css, /pointer-events:none!important/);
});

test("storefront hero photography cannot sit underneath an open full-screen customizer", () => {
  assert.match(css, /body\.abags-vc-open \.hero-product-photo/);
  assert.match(css, /visibility:hidden!important/);
});

test("finished-product Photo-True remains explicitly internal QA only", () => {
  assert.match(photoGate, /photoTrueQa/);
  assert.match(photoGate, /abags-photo-true-v5/);
  assert.match(photoGate, /abags-photo-mobile/);
  assert.match(photoGate, /Normal shoppers and ordinary automated browsers always use the realtime/);
});
