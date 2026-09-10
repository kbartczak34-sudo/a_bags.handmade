import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const renderer=fs.readFileSync(new URL("../app/bag-builder-photoreal-v17.tsx",import.meta.url),"utf8");
const layout=fs.readFileSync(new URL("../app/layout.tsx",import.meta.url),"utf8");

test("V17 is the sole final volumetric photoreal renderer",()=>{
  assert.match(layout,/import BagBuilderPhotorealV17 from "\.\/bag-builder-photoreal-v17"/);
  assert.match(layout,/<BagBuilderPhotorealV17 \/>/);
  assert.doesNotMatch(layout,/BagBuilderPhotorealV16/);
  assert.doesNotMatch(layout,/BagBuilderPhotorealV15/);
});

test("V17 uses physical front back sidewall rim and opening geometry",()=>{
  for(const fn of ["face","wall","tube","rim","opening"])assert.match(renderer,new RegExp(`function ${fn}\\(`));
  assert.match(renderer,/gl\.enable\(gl\.DEPTH_TEST\)/);
  assert.match(renderer,/gl\.disable\(gl\.CULL_FACE\)/);
});

test("V17 builds four distinct family profiles and swaps them live",()=>{
  for(const family of ["round","flap","mini","tote"])assert.match(renderer,new RegExp(family+":build"));
  assert.match(renderer,/canvas\.clientWidth<640/);
  assert.match(renderer,/previousFam!==fam/);
});

test("V17 preserves live crochet material and touch controls",()=>{
  assert.match(renderer,/uMat<\.5/);
  assert.match(renderer,/uStitch/);
  assert.match(renderer,/pointerdown/);
  assert.match(renderer,/pointermove/);
  assert.match(renderer,/wheel/);
  assert.match(renderer,/requestAnimationFrame\(render\)/);
});

test("V17 hides superseded renderers only after WebGL initialization",()=>{
  const webgl=renderer.indexOf('getContext("webgl"');
  const hide=renderer.indexOf('querySelectorAll<HTMLElement>');
  assert.ok(webgl>=0 && hide>webgl);
  assert.match(renderer,/abags-photoreal-v5-canvas/);
  assert.match(renderer,/abags-photoreal-v15-canvas/);
  assert.match(renderer,/abags-photoreal-v16-canvas/);
});
