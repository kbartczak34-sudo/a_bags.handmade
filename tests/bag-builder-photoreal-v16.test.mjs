import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const renderer=fs.readFileSync(new URL("../app/bag-builder-photoreal-v17.tsx",import.meta.url),"utf8");
const renderer19=fs.readFileSync(new URL("../app/bag-builder-photoreal-v19.tsx",import.meta.url),"utf8");
const mount=fs.readFileSync(new URL("../app/bag-builder-photoreal-v17-mount.tsx",import.meta.url),"utf8");
const layout=fs.readFileSync(new URL("../app/layout.tsx",import.meta.url),"utf8");
const customizer=fs.readFileSync(new URL("../app/exact-live-customizer.tsx",import.meta.url),"utf8");

test("single photoreal mount remains the final renderer entrypoint",()=>{
  assert.match(layout,/BagBuilderPhotorealV17Mount/);
  assert.doesNotMatch(layout,/BagBuilderPhotorealV16/);
  assert.doesNotMatch(layout,/BagBuilderPhotorealV15/);
  assert.doesNotMatch(layout,/BagBuilderPhotorealV[234]/);
  assert.doesNotMatch(layout,/BagBuilder3DEnhancer/);
});

test("authoritative mount waits for the live customizer stage and mounts V19",()=>{
  assert.match(mount,/abags-vc-dialog\.abags-vc-builder-active \.abags-bag-builder-stage/);
  assert.match(mount,/MutationObserver/);
  assert.match(mount,/BagBuilderPhotorealV19/);
  assert.match(mount,/abags-photoreal-v19-canvas/);
});

test("V17 fallback renderer remains physically volumetric",()=>{
  for(const fn of ["face","wall","tube","rim","opening"])assert.match(renderer,new RegExp(`\\b${fn}\\s*(?:=|\\()`));
  assert.match(renderer,/gl\.enable\(gl\.DEPTH_TEST\)/);
  assert.match(renderer,/gl\.disable\(gl\.CULL_FACE\)/);
});

test("V19 uses open-top physical geometry, material shading and four family profiles",()=>{
  for(const fn of ["shell","innerWalls","rim","arch"])assert.match(renderer19,new RegExp(`function ${fn}\\(`));
  for(const family of ["round","flap","mini","tote"])assert.match(renderer19,new RegExp(family+":"));
  assert.match(renderer19,/gl\.enable\(gl\.DEPTH_TEST\)/);
  assert.match(renderer19,/gl\.disable\(gl\.CULL_FACE\)/);
  assert.match(renderer19,/uStitch/);
  assert.match(renderer19,/uMetal/);
  assert.match(renderer19,/uColor/);
});

test("V19 keeps live family, color, stitch and accessory controls",()=>{
  for(const field of ["family","color","stitch","handles","strap","hardware","flap"])assert.match(renderer19,new RegExp(`stage\\.dataset\\.${field}`));
  assert.match(renderer19,/pointerdown/);
  assert.match(renderer19,/pointermove/);
  assert.match(renderer19,/wheel/);
  assert.match(renderer19,/requestAnimationFrame\(render\)/);
});

test("V19 is not competing with legacy WebGL visual mounts",()=>{
  for(const symbol of ["BagBuilderFinalWebGL3D","BagBuilder3DEnhancer","BagBuilderAgataCordWebGL","BagBuilderPhysicalCordGeometry","BagBuilderBasketPhysicalCordV2"])assert.doesNotMatch(customizer,new RegExp(symbol));
});
