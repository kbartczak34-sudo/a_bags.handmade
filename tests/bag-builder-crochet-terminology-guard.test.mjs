import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const guard = fs.readFileSync("app/bag-builder-crochet-terminology-guard.tsx", "utf8");
const exact = fs.readFileSync("app/exact-live-customizer.tsx", "utf8");
const engine = fs.readFileSync("app/bag-builder-engine.tsx", "utf8");

test("customer customizer mounts the final crochet terminology guard after reference layout controllers", () => {
  assert.match(exact, /BagBuilderCrochetTerminologyGuard/);
  assert.match(exact, /<BagBuilderReferenceV4 \/>[\s\S]*<BagBuilderCrochetTerminologyGuard \/>/);
});

test("visible stitch step is explicitly named Ścieg szydełkowy", () => {
  assert.match(guard, /const STITCH_LABEL = "Ścieg szydełkowy"/);
  assert.match(guard, /const STITCH_TITLE = "3\. Ścieg szydełkowy"/);
  assert.match(guard, /Wybierz strukturę ściegu szydełkowego/);
  assert.match(guard, /content: "Ścieg szydełkowy" !important/);
  assert.match(guard, /content: "3\. Ścieg szydełkowy" !important/);
});

test("crochet terminology is also exposed to assistive technology", () => {
  assert.match(guard, /legend\.setAttribute\("aria-label", STITCH_LABEL\)/);
  assert.match(guard, /heading\?\.setAttribute\("aria-label", STITCH_TITLE\)/);
  assert.match(guard, /help\?\.setAttribute\("aria-label", STITCH_HELP\)/);
});

test("builder source vocabulary remains crochet-accurate", () => {
  assert.match(engine, /title="Ścieg szydełkowy"/);
  assert.match(engine, /Wybierz ścieg szydełkowy/);
  assert.doesNotMatch(engine, /title="Splot"/);
});
