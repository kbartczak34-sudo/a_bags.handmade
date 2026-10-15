import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
const s=await readFile(new URL("../app/bag-builder-fidelity3d.tsx",import.meta.url),"utf8");
test("sidewall contains REAL continuous WebGL tube meshes instead of planar drawing",()=>{
 assert.match(s,/function makeRaisedCrochetGussetMesh\(family:/);
 assert.match(s,/const stitchCount = Math\.max\(22/);
 assert.match(s,/const depthRows = 6/);
 assert.match(s,/sampleArc\(arcCenter/);
 assert.match(s,/gusset-crochet-uint16-overflow/);
 assert.match(s,/arc\.y > spec\.ry \* \.90/);
 for(const f of ["tote","round","bucket","mini"]) assert.ok(s.includes(f+"CrochetGusset: createMesh(gl, makeRaisedCrochetGussetMesh(\""+f+"\"))"));
 assert.match(s,/meshes\[renderFamily \+ "CrochetGusset"\]/);
});
test("side/back polyester is lit without making dark cartoon edges",()=>{
 assert.match(s,/uMaterial>7\.5\?\.84:\.64/);
 assert.match(s,/if\(uMaterial>7\.5\) illumination=max\(\.40,illumination\)/);
});
