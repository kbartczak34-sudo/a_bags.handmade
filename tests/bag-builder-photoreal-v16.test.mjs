import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const renderer=fs.readFileSync(new URL("../app/bag-builder-photoreal-v17.tsx",import.meta.url),"utf8");
const renderer18=fs.readFileSync(new URL("../app/bag-builder-photoreal-v18.tsx",import.meta.url),"utf8");
const mount=fs.readFileSync(new URL("../app/bag-builder-photoreal-v17-mount.tsx",import.meta.url),"utf8");
const layout=fs.readFileSync(new URL("../app/layout.tsx",import.meta.url),"utf8");
const customizer=fs.readFileSync(new URL("../app/exact-live-customizer.tsx",import.meta.url),"utf8");

test("V17 mount is retained as the single final renderer entrypoint",()=>{
  assert.match(layout,/BagBuilderPhotorealV17Mount/);
  assert.doesNotMatch(layout,/BagBuilderPhotorealV16/);
  assert.doesNotMatch(layout,/BagBuilderPhotorealV15/);
  assert.doesNotMatch(layout,/BagBuilderPhotorealV[234]/);
  assert.doesNotMatch(layout,/BagBuilder3DEnhancer/);
});

test("authoritative mount waits for the live customizer stage",()=>{
  assert.match(mount,/abags-vc-dialog\.abags-vc-builder-active \.abags-bag-builder-stage/);
  assert.match(mount,/MutationObserver/);
  assert.match(mount,/BagBuilderPhotorealV18/);
  assert.match(mount,/abags-photoreal-v18-canvas/);
});

test("V17 fallback renderer remains physically volumetric",()=>{
  for(const fn of ["face","wall","tube","rim","opening"])assert.match(renderer,new RegExp(`\\b${fn}\\s*(?:=|\\()`));
  assert.match(renderer,/gl\.enable\(gl\.DEPTH_TEST\)/);
  assert.match(renderer,/gl\.disable\(gl\.CULL_FACE\)/);
});

test("V18 has actual product geometry, material shading and four family profiles",()=>{
  for(const fn of ["bodyMesh","tubeArch","rimMesh"])assert.match(renderer18,new RegExp(`function ${fn}\\(`));
  for(const family of ["round","flap","mini","tote"])assert.match(renderer18,new RegExp(family+":"));
  assert.match(renderer18,/gl\.enable\(gl\.DEPTH_TEST\)/);
  assert.match(renderer18,/gl\.disable\(gl\.CULL_FACE\)/);
  assert.match(renderer18,/uStitch/);
  assert.match(renderer18,/uMetal/);
  assert.match(renderer18,/uColor/);
});

test("V18 keeps live family, color, stitch and accessory controls",()=>{
  assert.match(renderer18,/stage\.dataset\.family/);
  assert.match(renderer18,/stage\.dataset\.color/);
  assert.match(renderer18,/stage\.dataset\.handles/);
  assert.match(renderer18,/stage\.dataset\.strap/);
  assert.match(renderer18,/pointerdown/);
  assert.match(renderer18,/pointermove/);
  assert.match(renderer18,/wheel/);
  assert.match(renderer18,/requestAnimationFrame\(render\)/);
});

test("V18 is not competing with legacy WebGL visual mounts",()=>{
  for(const symbol of ["BagBuilderFinalWebGL3D","BagBuilder3DEnhancer","BagBuilderAgataCordWebGL","BagBuilderPhysicalCordGeometry","BagBuilderBasketPhysicalCordV2"])assert.doesNotMatch(customizer,new RegExp(symbol));
});
