import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(
  new URL("../app/bag-builder-agata-cord-webgl.css", import.meta.url),
  "utf8",
);

const FINAL3D_MARKER =
  '.abags-bag-builder-stage[data-abags-final3d="ready"]';

test("Agata WebGL remains mounted only as a compatibility renderer and is never customer-visible on final Fidelity3D", () => {
  assert.match(css, /abags-agata-cord-webgl/);
  const finalRule = css.slice(css.indexOf(FINAL3D_MARKER));
  assert.match(finalRule, /opacity:0!important/);
  assert.match(finalRule, /visibility:hidden!important/);
});

test("canonical Fidelity canvas is fully visible on the verified final 3D stage", () => {
  const finalRule = css.slice(css.indexOf(FINAL3D_MARKER));
  assert.match(finalRule, /abags-fidelity3d-canvas/);
  assert.match(finalRule, /opacity:1!important/);
  assert.match(finalRule, /visibility:visible!important/);
  assert.doesNotMatch(finalRule, /opacity:\.06!important/);
});

test("legacy crochet topology cannot become a second visible product surface", () => {
  const finalRule = css.slice(css.indexOf(FINAL3D_MARKER));
  assert.match(finalRule, /abags-crochet-relief-surface/);
  assert.match(finalRule, /opacity:0!important/);
  assert.match(finalRule, /visibility:hidden!important/);
});

test("Basket V6 compatibility surface cannot replace the canonical 3D model", () => {
  const finalRule = css.slice(css.indexOf(FINAL3D_MARKER));
  assert.match(finalRule, /abags-basket-weave-surface/);
  assert.match(finalRule, /opacity:0!important/);
  assert.match(finalRule, /visibility:hidden!important/);
});

test("final 3D compositor does not contain an Agata material ownership promotion", () => {
  assert.doesNotMatch(
    css,
    /data-abags-final3d="ready"[^{}]*data-abags-agata-cord-webgl="agata-cord-webgl-v1-photo-calibrated"[^{}]*>[^{}]*abags-agata-cord-webgl\s*\{[^}]*opacity:1!important/,
  );
  assert.doesNotMatch(
    css,
    /data-abags-final3d="ready"[^{}]*>[^{}]*abags-fidelity3d-canvas\s*\{[^}]*opacity:\.06!important/,
  );
});

test("material compatibility rules remain excluded from Photo-True", () => {
  const exclusions = css.match(/not\(\[data-abags-photo-true="active"\]\)/g) ?? [];
  assert.ok(exclusions.length >= 1, "compatibility material selectors must exclude Photo-True");
});
