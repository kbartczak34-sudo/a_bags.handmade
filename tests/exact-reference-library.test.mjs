import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync("app/exact-reference-library.tsx", "utf8");
const css = fs.readFileSync("app/exact-reference-library.css", "utf8");
const layout = fs.readFileSync("app/layout.tsx", "utf8");

test("exact reference library reads unchanged storefront product images", () => {
  assert.match(source, /fetch\("\/api\/products"/);
  assert.match(source, /Biblioteka atelier · 1:1/);
  assert.match(source, /Rzeczywiste wzorce produktów/);
  assert.match(source, /oryginał 1:1/);
  assert.match(source, /selected\.imageUrl/);
  assert.match(source, /abags-vc-exact-reference/);
});

test("exact reference mode disables synthetic preview layers", () => {
  assert.match(source, /has-exact-reference/);
  assert.match(css, /\.abags-vc-preview\.has-exact-reference::before/);
  assert.match(css, /\.abags-vc-preview\.has-exact-reference::after/);
  assert.match(css, /\.abags-vc-preview\.has-exact-reference \.abags-vc-base/);
  assert.match(css, /\.abags-vc-preview\.has-exact-reference \.abags-vc-layer/);
  assert.match(css, /opacity:0!important/);
});

test("exact reference library is mounted globally with its styles", () => {
  assert.match(layout, /import ExactReferenceLibrary from "\.\/exact-reference-library"/);
  assert.match(layout, /import "\.\/exact-reference-library\.css"/);
  assert.match(layout, /<ExactReferenceLibrary \/>/);
});

test("choosing a normal configurator option exits exact reference mode", () => {
  assert.match(source, /target\.closest\("\.abags-vc-controls button"\)/);
  assert.match(source, /setSelectedId\(""\)/);
  assert.match(source, /Wróć do konfiguracji warstwowej/);
});
