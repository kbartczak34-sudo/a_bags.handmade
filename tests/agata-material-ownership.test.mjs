import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(
  new URL("../app/bag-builder-agata-cord-webgl.css", import.meta.url),
  "utf8",
);

function ruleBody(selectorPattern) {
  const match = css.match(new RegExp(`${selectorPattern}\\{([^}]*)\\}`));
  assert.ok(match, `missing CSS rule for ${selectorPattern}`);
  return match[1];
}

test("Agata WebGL becomes the customer-visible stitch material after the verified frame", () => {
  assert.match(css, /data-abags-final3d="ready"/);
  assert.match(css, /data-abags-agata-cord-webgl="agata-cord-webgl-v1-photo-calibrated"/);
  const agataRule = ruleBody("> \\.abags-fidelity3d-layer > \\.abags-agata-cord-webgl");
  assert.match(agataRule, /opacity:1!important/);
  assert.match(agataRule, /visibility:visible!important/);
});

test("base Fidelity canvas stays live at the strict production verification floor beneath Agata", () => {
  assert.match(css, /Verification floor/);
  const fidelityRule = ruleBody("> \\.abags-fidelity3d-layer > \\.abags-fidelity3d-canvas");
  assert.match(fidelityRule, /display:block!important/);
  assert.match(fidelityRule, /opacity:\.06!important/);
  assert.match(fidelityRule, /visibility:visible!important/);
  assert.doesNotMatch(fidelityRule, /display:none!important/);
  assert.doesNotMatch(fidelityRule, /opacity:0!important/);
});

test("legacy crochet topology is mounted but no longer double-composited over Agata WebGL", () => {
  const reliefRule = ruleBody("> \\.abags-fidelity3d-layer > \\.abags-crochet-relief-surface");
  assert.match(reliefRule, /opacity:0!important/);
  assert.match(reliefRule, /visibility:visible!important/);
});

test("material ownership handoff remains excluded from Photo-True", () => {
  const exclusions = css.match(/not\(\[data-abags-photo-true="active"\]\)/g) ?? [];
  assert.ok(exclusions.length >= 4, "all Agata material ownership selectors must exclude Photo-True");
});
