import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const src=await readFile(new URL("../app/bag-builder-fidelity3d.tsx",import.meta.url),"utf8");
test("selected openwork stitch uses true tube rings on BOTH sides of the product",()=>{
  assert.match(src,/function makeRaisedCrochetCordMesh\(family:/);
  assert.match(src,/const radius = spec\.rx \* \(0\.005 \/ 0\.16\)/);
  assert.match(src,/for \(const side of \[1, -1\] as const\)/);
  assert.match(src,/const tangent = normalize/);
  assert.match(src,/normals\.push\(\.\.\.n\)/);
  assert.match(src,/const tubeSides = 8/);
  assert.match(src,/const axialSteps = 11/);
  assert.match(src,/raised-crochet-uint16-overflow/);
  assert.doesNotMatch(src,/lineWidth\(/);
});
test("all family meshes are generated without image-planar stickers",()=>{
 for (const family of ["tote","round","bucket","mini"])
  assert.ok(src.includes(family+"CrochetCord: createMesh(gl, makeRaisedCrochetCordMesh(\""+family+"\"))"));
 assert.match(src,/const physicalVStitch = config\.stitch === "herringbone"/);
 assert.match(src,/drawMesh\(renderer, meshes\[renderFamily \+ "CrochetCord"\], shellPose, body, 7, stitch, 0\)/);
 assert.match(src,/physicalVStitch \? 8 : 0/);
 assert.match(src,/physicalVStitch \? 0 : relief/);
 assert.match(src,/gl\.enable\(gl\.DEPTH_TEST\)/);
});
test("real fabric responds to cylindrical normals and has no hard wire-grid mesh",()=>{
 assert.match(src,/if\(uMaterial<7\.5\)/);
 assert.match(src,/float filament=sin/);
 assert.match(src,/rough=\.89/);
 assert.match(src,/Underlying continuous crochet body/);
});
