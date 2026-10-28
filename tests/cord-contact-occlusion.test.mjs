import assert from "node:assert/strict";
import test from "node:test";
import { geometry as g } from "./helpers/fidelity-geometry.mjs";

const empty = () => ({positions:[],normals:[],uvs:[],indices:[]});

test("contact darkens a crossing while the exposed cord crown remains open to light", () => {
  const mesh=empty(), spans=[];
  const lower=Array.from({length:17},(_,i)=>[-.24+i*.03,0,0]);
  const upper=Array.from({length:17},(_,i)=>[0,-.24+i*.03,.061]);
  g.appendCord(mesh,lower,.03,()=>[0,0,1],()=>true,10,false,spans);
  g.bakeCordOcclusion(mesh,spans);
  assert.ok(mesh.occlusion.every(value=>value>.98),"an isolated straight strand does not cast a false shadow on itself");
  const upperStart=mesh.positions.length/3;
  g.appendCord(mesh,upper,.03,()=>[0,0,1],()=>true,10,false,spans);
  g.bakeCordOcclusion(mesh,spans);
  assert.equal(mesh.occlusion.length,mesh.positions.length/3);
  assert.ok(mesh.occlusion.every(value=>Number.isFinite(value)&&value>=.40&&value<=1));
  const crossing=[], crown=[];
  for(let i=upperStart;i<mesh.occlusion.length;i++) {
    if(Math.abs(mesh.positions[i*3+1])<.04) {
      crossing.push(mesh.occlusion[i]);
      if(mesh.normals[i*3+2]>.8)crown.push(mesh.occlusion[i]);
    }
  }
  assert.ok(Math.min(...crossing)<.75,"neighbouring yarn produces a contact shadow");
  assert.ok(crown.length&&crown.every(value=>value>.98),"the outward crown is not covered by the lower strand");
});

test("splitting one occluding strand into more capsule segments does not multiply its shadow", () => {
  const probe=()=>({positions:[0,0,0],normals:[0,0,1],uvs:[0,0],indices:[]});
  const whole=probe(), split=probe();
  g.bakeCordOcclusion(whole,[{a:[-.2,.02,.06],b:[.2,.02,.06],radius:.03,owner:0}]);
  const spans=Array.from({length:16},(_,i)=>({a:[-.2+i*.025,.02,.06],b:[-.2+(i+1)*.025,.02,.06],radius:.03,owner:0}));
  g.bakeCordOcclusion(split,spans);
  assert.ok(whole.occlusion[0]<1);
  assert.ok(Math.abs(whole.occlusion[0]-split.occlusion[0])<1e-6);
});

test("the GPU UV buffer preserves fabric coordinates and supplies neutral visibility for other materials", () => {
  let bound;
  const gl={ARRAY_BUFFER:1,ELEMENT_ARRAY_BUFFER:2,STATIC_DRAW:3,
    createBuffer:()=>({}),bindBuffer:(_target,value)=>{bound=value;},
    bufferData:(_target,value)=>{bound.data=value;}};
  const source={positions:[0,0,0,1,0,0],normals:[0,0,1,0,0,1],uvs:[.2,.4,.8,.6],indices:[]};
  const plain=g.createMesh(gl,source), cord=g.createMesh(gl,{...source,occlusion:[.4,.9]});
  assert.deepEqual([...plain.uv.data],[...new Float32Array([.2,.4,1,.8,.6,1])]);
  assert.deepEqual([...cord.uv.data],[...new Float32Array([.2,.4,.4,.8,.6,.9])]);
  const auto=g.createMesh(gl,{...source,cordOccluders:[{a:[-.2,.02,.06],b:[.2,.02,.06],radius:.03,owner:0}]});
  assert.ok(auto.uv.data[2]<1,"GPU upload computes contact visibility for unbaked cord geometry");
  assert.equal(auto.uv.data[5],1,"the remote vertex remains exposed");
});

test("separate lengths of yarn have distinct repeatable carrier phases without changing physical braid density", () => {
  const build=offset=>{
    const mesh=empty();
    const path=Array.from({length:12},(_,i)=>[offset+i*.03,.11,0]);
    g.appendCord(mesh,path,.03,()=>[0,0,1],()=>true,10);
    return mesh;
  };
  const a=build(0), repeated=build(0), b=build(.17);
  assert.deepEqual(a.positions,repeated.positions);
  assert.deepEqual(a.normals,repeated.normals);
  assert.notEqual(a.uvs[0],b.uvs[0],"adjacent physical cords are not identical stamped copies");
  const last=(12-1)*11*2;
  assert.ok(Math.abs((a.uvs[last]-a.uvs[0])-(b.uvs[last]-b.uvs[0]))<1e-9,"twist scale remains tied to 5 mm cord");
});
