import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(
  new URL("../app/bag-builder-agata-cord-webgl.css", import.meta.url),
  "utf8",
);

test("Agata WebGL becomes the customer-visible stitch material after the verified frame", () => {
  assert.match(css, /data-abags-final3d="ready"/);
  assert.match(css, /data-abags-agata-cord-webgl="agata-cord-webgl-v1-photo-calibrated"/);
  assert.match(css, /> \.abags-fidelity3d-layer > \.abags-agata-cord-webgl\{[\s\S]*z-index:2!important;[\s\S]*opacity:1!important;[\s\S]*visibility:visible!important;/);
});

test("base Fidelity canvas stays live at the strict production verification floor beneath Agata", () => {
  assert.match(css, /Verification floor/);
  assert.match(css, /> \.abags-fidelity3d-layer > \.abags-fidelity3d-canvas\{[\s\S]*display:block!important;[\s\S]*opacity:\.06!important;[\s\S]*visibility:visible!important;/);
  assert.doesNotMatch(css, /> \.abags-fidelity3d-layer > \.abags-fidelity3d-canvas\{[\s\S]*display:none!important;/);
  assert.doesNotMatch(css, /> \.abags-fidelity3d-layer > \.abags-fidelity3d-canvas\{[\s\S]*opacity:0!important;/);
});

test("legacy crochet topology is mounted but no longer double-composited over Agata WebGL", () => {
  assert.match(css, /> \.abags-fidelity3d-layer > \.abags-crochet-relief-surface\{[\s\S]*opacity:0!important;[\s\S]*visibility:visible!important;/);
});

test("material ownership handoff remains excluded from Photo-True", () => {
  const exclusions = css.match(/not\(\[data-abags-photo-true="active"\]\)/g) ?? [];
  assert.ok(exclusions.length >= 4, "all Agata material ownership selectors must exclude Photo-True");
});
