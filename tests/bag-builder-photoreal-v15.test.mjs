import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const renderer = fs.readFileSync(new URL("../app/bag-builder-photoreal-v17.tsx", import.meta.url), "utf8");

test("current photoreal renderer is V17", () => {
  assert.ok(layout.includes('import BagBuilderPhotorealV17 from "./bag-builder-photoreal-v17"'));
  assert.ok(layout.includes("<BagBuilderPhotorealV17 />"));
  assert.doesNotMatch(layout, /BagBuilderPhotorealV15/);
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
