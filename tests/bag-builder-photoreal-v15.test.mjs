import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const renderer = fs.readFileSync(new URL("../app/bag-builder-photoreal-v15.tsx", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

test("Photoreal V15 is mounted after legacy visual passes", () => {
  assert.match(layout, /import BagBuilderPhotorealV15 from "\.\/bag-builder-photoreal-v15"/);
  assert.match(layout, /<BagBuilderPhotorealV5 \/>\s*<BagBuilderPhotorealV15 \/>/);
});

test("Photoreal V15 has physical bag construction", () => {
  assert.match(renderer, /side\(shape\[0\],shape\[1\],pow,shape\[2\]\)/);
  assert.match(renderer, /panel\(shape\[0\]\*\.985,shape\[1\]-\.30/);
  assert.match(renderer, /opening\(shape\[0\]\*\.38,shape\[2\]\*\.36,\.55\)/);
  assert.match(renderer, /rim\(shape\[0\]\*\.43,shape\[2\]\*\.38,\.56\)/);
  assert.match(renderer, /tube\(\[\[-shape\[0\]\*\.34/);
});

test("Photoreal V15 has real depth and material shading", () => {
  assert.match(renderer, /gl\.enable\(gl\.DEPTH_TEST\)/);
  assert.match(renderer, /gl\.enable\(gl\.CULL_FACE\)/);
  assert.match(renderer, /noise|nse/);
  assert.match(renderer, /uStitch/);
  assert.match(renderer, /uMat/);
});

test("Photoreal V15 supports all four product families and mobile framing", () => {
  for (const family of ["round", "flap", "mini", "tote"]) assert.match(renderer, new RegExp(family));
  assert.match(renderer, /canvas\.clientWidth<640/);
  assert.match(renderer, /mobile\?4\.9:4\.5/);
});

test("Photoreal V15 disables older renderers only after WebGL succeeds", () => {
  const webgl = renderer.indexOf('canvas.getContext("webgl"');
  const hide = renderer.indexOf('querySelectorAll<HTMLElement>');
  assert.ok(webgl >= 0 && hide > webgl);
  assert.match(renderer, /abags-photoreal-v5-canvas/);
});
