import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [stack, css] = await Promise.all([
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-flap-realism-tuning.css", import.meta.url), "utf8"),
]);

test("crochet flap tuning is loaded by the live customizer", () => {
  assert.match(stack, /import "\.\/bag-builder-flap-realism-tuning\.css"/);
});

test("crochet flap keeps cord texture by reducing only the surface-polish layer", () => {
  assert.match(css, /data-flap="crochet"/);
  assert.match(css, /> \.abags-flap-realism/);
  assert.match(css, /opacity:\.62!important/);
  assert.match(css, /@media \(max-width:620px\)/);
  assert.match(css, /opacity:\.54!important/);
  assert.doesNotMatch(css, /abags-fidelity3d-canvas|transform:|filter:/);
});
