import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const v16 = fs.readFileSync(new URL("../app/bag-builder-photoreal-v16.tsx", import.meta.url), "utf8");

test("Photoreal V5 is superseded by the current V16 renderer", () => {
  assert.doesNotMatch(layout, /<BagBuilderPhotorealV5 \/>/);
  assert.match(layout, /<BagBuilderPhotorealV16 \/>/);
});

test("current renderer owns the volumetric construction contract", () => {
  assert.match(v16, /function wall\(/);
  assert.match(v16, /function face\(/);
  assert.match(v16, /function tube\(/);
  assert.match(v16, /function rim\(/);
  assert.match(v16, /function opening\(/);
});
