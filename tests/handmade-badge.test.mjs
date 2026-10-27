import assert from "node:assert/strict";
import test from "node:test";
import { geometry } from "./helpers/fidelity-geometry.mjs";

test("the rounded plaque, raised rim and engraved script stay portable and finite", () => {
  const badge = geometry.makeHandmadeBadge();
  for (const [name,mesh] of Object.entries(badge)) {
    const vertices = mesh.positions.length / 3;
    assert.ok(vertices > 100 && vertices < 65536, `${name}: WebGL 1 vertex budget`);
    assert.equal(mesh.normals.length,mesh.positions.length);
    assert.equal(mesh.uvs.length,vertices*2);
    assert.ok(mesh.positions.every(Number.isFinite));
    assert.ok(mesh.indices.every(i=>Number.isInteger(i)&&i>=0&&i<vertices));
    for(let i=0;i<mesh.normals.length;i+=3)
      assert.ok(Math.abs(Math.hypot(...mesh.normals.slice(i,i+3))-1)<.001);
  }
});

test("the full Handmade lettering fits between the mounting screws and inside the frame", () => {
  const paths = geometry.handmadeBadgeLettering();
  assert.ok(paths.length >= 8);
  const points = paths.flat();
  const xs = points.map(p=>p[0]), ys=points.map(p=>p[1]);
  assert.ok(Math.max(...xs)-Math.min(...xs)>.20, "the word uses the available plaque face");
  assert.ok(Math.max(...ys)-Math.min(...ys)>.035, "capital and ascending strokes remain legible");
  for(const [x,y] of points) {
    assert.ok(Math.abs(x)<.12, "lettering must clear both mounting screws");
    assert.ok(Math.abs(y)<.03, "lettering must clear the raised frame");
  }
  for(const path of paths) for(let i=1;i<path.length;i++)
    assert.ok(Math.hypot(path[i][0]-path[i-1][0],path[i][1]-path[i-1][1])<.007,
      "curved strokes must not jump across a letter");
});

test("the label is above the plaque face and below the raised protective rim", () => {
  const {metal,engraving}=geometry.makeHandmadeBadge();
  const letterZ=[];
  for(let i=0;i<engraving.positions.length;i+=3)
    if(Math.abs(engraving.positions[i])<.12)letterZ.push(engraving.positions[i+2]);
  const plate = geometry.makeCognacPlate(geometry.roundedRectangle(.32,.088,.044),.009);
  const faceZ=Math.max(...plate.positions.filter((_,i)=>i%3===2));
  assert.ok(Math.min(...letterZ)>faceZ, "engraving colour must not be buried in the plate");
  const frameZ=[];
  for(let i=0;i<metal.positions.length;i+=3)
    if(Math.abs(metal.positions[i+1])>.03)frameZ.push(metal.positions[i+2]);
  assert.ok(Math.max(...frameZ)>Math.max(...letterZ), "the frame sits above the inscription");
});
