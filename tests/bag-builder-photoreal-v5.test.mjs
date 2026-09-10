import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const renderer = fs.readFileSync(new URL("../app/bag-builder-photoreal-v17.tsx", import.meta.url), "utf8");

test("V5 contract now delegates to the current V17 renderer", () => {
  assert.doesNotMatch(layout, /<BagBuilderPhotorealV5 \/>/);
  assert.match(layout, /<BagBuilderPhotorealV17 \/>/);
});

test("current renderer owns volumetric construction", () => {
  assert.match(renderer, /function face\(/);
  assert.match(renderer, /function wall\(/);
  assert.match(renderer, /function rim\(/);
  assert.match(renderer, /function opening\(/);
  assert.match(renderer, /function tube\(/);
});
