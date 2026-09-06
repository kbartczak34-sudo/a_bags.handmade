import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(
  new URL("../app/bag-builder-agata-cord-webgl.css", import.meta.url),
  "utf8",
);

function ruleBodyAfter(marker, selector) {
  const markerIndex = css.indexOf(marker);
  assert.ok(markerIndex >= 0, `missing CSS state marker: ${marker}`);
  const selectorIndex = css.indexOf(selector, markerIndex);
  assert.ok(selectorIndex >= markerIndex, `missing CSS selector after state marker: ${selector}`);
  const openBrace = css.indexOf("{", selectorIndex);
  const closeBrace = css.indexOf("}", openBrace + 1);
  assert.ok(openBrace >= selectorIndex && closeBrace > openBrace, `invalid CSS rule for ${selector}`);
  return css.slice(openBrace + 1, closeBrace);
}

const ACTIVE_AGATA_MARKER =
  '.abags-bag-builder-stage[data-abags-final3d="ready"][data-abags-agata-cord-webgl="agata-cord-webgl-v1-photo-calibrated"]';
const AGATA_READY_MARKER =
  '.abags-bag-builder-stage[data-abags-agata-cord-webgl="agata-cord-webgl-v1-photo-calibrated"]';
const ACTIVE_BASKET_MARKER =
  '.abags-bag-builder-stage[data-stitch="basket"][data-abags-agata-cord-webgl="agata-cord-webgl-v1-photo-calibrated"]';

test("Agata WebGL becomes the customer-visible stitch material after the verified frame", () => {
  const agataRule = ruleBodyAfter(ACTIVE_AGATA_MARKER, "> .abags-fidelity3d-layer > .abags-agata-cord-webgl");
  assert.match(agataRule, /opacity:1!important/);
  assert.match(agataRule, /visibility:visible!important/);
});

test("base Fidelity canvas stays live at the strict production verification floor beneath Agata", () => {
  assert.match(css, /Verification floor/);
  const fidelityRule = ruleBodyAfter(ACTIVE_AGATA_MARKER, "> .abags-fidelity3d-layer > .abags-fidelity3d-canvas");
  assert.match(fidelityRule, /display:block!important/);
  assert.match(fidelityRule, /opacity:\.06!important/);
  assert.match(fidelityRule, /visibility:visible!important/);
  assert.doesNotMatch(fidelityRule, /display:none!important/);
  assert.doesNotMatch(fidelityRule, /opacity:0!important/);
});

test("legacy crochet topology is mounted but no longer double-composited over Agata WebGL", () => {
  const reliefRule = ruleBodyAfter(AGATA_READY_MARKER, "> .abags-fidelity3d-layer > .abags-crochet-relief-surface");
  assert.match(reliefRule, /opacity:0!important/);
  assert.match(reliefRule, /visibility:visible!important/);
});

test("legacy basket canvas remains fallback-only after Agata owns the basket material", () => {
  assert.match(css, /Basket ownership handoff/);
  const basketRule = ruleBodyAfter(ACTIVE_BASKET_MARKER, "> .abags-fidelity3d-layer > .abags-basket-weave-surface");
  assert.match(basketRule, /opacity:0!important/);
  assert.match(basketRule, /visibility:visible!important/);
  assert.match(basketRule, /mix-blend-mode:normal!important/);
});

test("material ownership handoff remains excluded from Photo-True", () => {
  const exclusions = css.match(/not\(\[data-abags-photo-true="active"\]\)/g) ?? [];
  assert.ok(exclusions.length >= 5, "all Agata material ownership selectors must exclude Photo-True");
});
