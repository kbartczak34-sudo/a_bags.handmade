import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const renderer=fs.readFileSync(new URL("../app/bag-builder-photoreal-v16.tsx",import.meta.url),"utf8");
const layout=fs.readFileSync(new URL("../app/layout.tsx",import.meta.url),"utf8");

test("V16 is the sole final photoreal renderer",()=>{
  assert.match(layout,/import BagBuilderPhotorealV16 from "\.\/bag-builder-photoreal-v16"/);
  assert.match(layout,/<BagBuilderPhotorealV16 \/>/);
  assert.doesNotMatch(layout,/BagBuilderPhotorealV15/);
});

test("V16 uses physical front back and sidewall geometry",()=>{
  assert.match(renderer,/function face\(/);
  assert.match(renderer,/function wall\(/);
  assert.match(renderer,/function tube\(/);
  assert.match(renderer,/function rim\(/);
  assert.match(renderer,/function opening\(/);
  assert.match(renderer,/gl\.enable\(gl\.DEPTH_TEST\)/);
});

test("V16 has four distinct family profiles and mobile camera",()=>{
  for(const family of ["round","flap","mini","tote"])assert.match(renderer,new RegExp(family));
  assert.match(renderer,/canvas\.clientWidth<640/);
  assert.match(renderer,/mobile\?4\.9:4\.55/);
});

test("V16 preserves live crochet material and touch controls",()=>{
  assert.match(renderer,/uMat<\.5/);
  assert.match(renderer,/uStitch/);
  assert.match(renderer,/pointerdown/);
  assert.match(renderer,/pointermove/);
  assert.match(renderer,/wheel/);
  assert.match(renderer,/requestAnimationFrame\(render\)/);
});

test("V16 hides superseded renderers only after WebGL initialization",()=>{
  const webgl=renderer.indexOf('getContext("webgl"');
  const hide=renderer.indexOf('querySelectorAll<HTMLElement>');
  assert.ok(webgl>=0 && hide>webgl);
  assert.match(renderer,/abags-photoreal-v5-canvas/);
  assert.match(renderer,/abags-photoreal-v15-canvas/);
});
