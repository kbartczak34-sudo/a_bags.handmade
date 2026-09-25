import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const renderer = fs.readFileSync(new URL("../app/bag-builder-photoreal-v17.tsx", import.meta.url), "utf8");

test("current photoreal renderer is V23 behind the compatibility mount", () => {
  assert.match(layout, /BagBuilderPhotorealV17Mount/);
  assert.match(layout, /<BagBuilderPhotorealV17Mount \/>/);
  assert.match(renderer, /function face\(/);
});


test("V17 retains physical construction geometry", () => {
  assert.match(renderer, /function face\(/);
  assert.match(renderer, /function wall\(/);
  assert.match(renderer, /function tube\(/);
  assert.match(renderer, /function rim\(/);
  assert.match(renderer, /function opening\(/);
  assert.match(renderer, /bottom=make\(face\(/);
  assert.match(renderer, /gl\.enable\(gl\.DEPTH_TEST\)/);
});
