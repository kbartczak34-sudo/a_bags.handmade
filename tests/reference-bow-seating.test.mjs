import assert from "node:assert/strict";
import test from "node:test";
import { Matrix4, Triangle, Vector3 } from "three";
import { geometry as g, referenceModels as models, specs } from "./helpers/fidelity-geometry.mjs";

const wooden = models.filter(model => model.config.handles.startsWith("wood"));
const world = (m,p) => [0,1,2].map(i=>m[12+i]+m[i]*p[0]+m[4+i]*p[1]+m[8+i]*p[2]);
const empty = () => ({positions:[],normals:[],uvs:[],indices:[]});

test("each photographed bow shares its actual handle mount with the surrounding fabric", () => {
  for (const {id,config} of wooden) {
    const frame=g.woodHandleRibbonFrame(config.family,config);
    const anchor=g.fidelityAccessoryAnchor(config);
    const expected=world(frame.model,[frame.center[0],frame.center[1],.055]);
    assert.ok(anchor.every((n,i)=>Math.abs(n-expected[i])<1e-8),id);
    const top=specs[config.family].bodyY+specs[config.family].ry;
    if(id==="forest-ocean-wood-bow") assert.ok(anchor[1]>top,"the ocean photograph ties its bow above the rim");
    else assert.ok(anchor[1]<top-.05,"the other four photographs tie below the rim, rather than high on the open arch");
    for(const v of [-1,0,1]) {
      const a=g.woodHandleRibbonPoint(config.family,0,v,config), b=g.woodHandleRibbonPoint(config.family,1,v,config);
      assert.ok(a.every((n,i)=>Math.abs(n-b[i])<1e-8),"the surrounding cuff must close at its seam");
    }
  }
});

const woodTriangles = new Map(), bindings = new Map();
function rigidWood(shape) {
  if(!woodTriangles.has(shape)) {
    const mesh=g.makeReferenceWoodHandle(shape), pose=new Matrix4().fromArray(g.woodHandleMatrix("tall-tote",g.woodHandleDepthPlanes("tall-tote")[1]));
    const vertex=i=>new Vector3().fromArray(mesh.positions,i*3).applyMatrix4(pose), triangles=[];
    for(let i=0;i<mesh.indices.length;i+=3)triangles.push(new Triangle(...mesh.indices.slice(i,i+3).map(vertex)));
    woodTriangles.set(shape,triangles);
  }
  return woodTriangles.get(shape);
}
function distanceToWinding(p,shape) {
  if(!bindings.has(shape))bindings.set(shape,g.woodHandleBindingPaths("tall-tote",g.woodHandleDepthPlanes("tall-tote")[1],shape));
  const {winding,radius}=bindings.get(shape);
  let distance=Infinity;
  for(let i=1;i<winding.length;i++) {
    const a=winding[i-1],b=winding[i],x=b[0]-a[0],y=b[1]-a[1],z=b[2]-a[2];
    const t=Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[1]-a[1])*y+(p[2]-a[2])*z)/(x*x+y*y+z*z||1)));
    distance=Math.min(distance,Math.hypot(p[0]-a[0]-t*x,p[1]-a[1]-t*y,p[2]-a[2]-t*z)-radius);
  }
  return distance;
}

test("both faces of the scarf cuff clear the real broad wood and the cord already wound around it", () => {
  const generic={...wooden[0].config,color:"#123456"};
  for(const config of [generic,...wooden.map(model=>model.config)]) {
    const shape=g.getAbagsWoodHandleShape(config), frame=g.woodHandleRibbonFrame(config.family,config), cuff=empty();
    g.appendOrnamentRibbon(cuff,(u,v)=>g.woodHandleRibbonPoint(config.family,u,v,config),48,8);
    const probe=new Vector3(),nearest=new Vector3();
    for(let vertex=0;vertex<cuff.positions.length/3;vertex+=13) {
      probe.fromArray(cuff.positions,vertex*3);
      let distance=Infinity;
      for(const triangle of rigidWood(shape)) {triangle.closestPointToPoint(probe,nearest);distance=Math.min(distance,probe.distanceTo(nearest));}
      assert.ok(distance>.002,`${config.color}: fabric enters the wooden face (${distance})`);
      if(frame.bound) assert.ok(distanceToWinding([probe.x,probe.y,probe.z],shape)>.001,`${config.color}: fabric enters the existing cord winding`);
    }
    const n=cuff.positions.length/3;
    assert.ok(n<65536&&cuff.indices.every(i=>i>=0&&i<n));
    for(let i=0;i<cuff.normals.length;i+=3)assert.ok(Math.abs(Math.hypot(...cuff.normals.slice(i,i+3))-1)<1e-6);
  }
});

test("photographed wings are broad fabric folds and the long navy and pastel tails stop above the bag base", () => {
  for(const model of wooden.filter(m=>m.id!=="forest-ocean-wood-bow")) {
    const config=model.config;
    for(const side of [-1,1]) {
      const top=g.referenceRibbonLoop(config,.5,1,side), bottom=g.referenceRibbonLoop(config,.5,-1,side), center=g.referenceRibbonLoop(config,.5,0,side);
      const ratio=(top[1]-bottom[1])/Math.abs(center[0]);
      assert.ok(ratio>.65&&ratio<1.15,model.id+": wing is too thin or too tall relative to its photographed span");
    }
    const bounds=g.makeOrnamentGeometry(config).bounds;
    const base=specs[config.family].bodyY-specs[config.family].ry;
    assert.ok(bounds.min[1]>base+.025,model.id+": scarf drags below the body");
  }
});

test("only the rose and cacao reference bows have a separately dyed gathered satin band", () => {
  for(const model of models) {
    const parts=g.makeOrnamentGeometry(model.config).parts;
    const band=parts.find(part=>part.tone==="knot");
    assert.equal(Boolean(band),["rose-cream-dark-wood","cacao-cream-wood-bow"].includes(model.id));
    if(band) {
      assert.equal(band.material,3.25);
      assert.ok(band.mesh.indices.length>1000&&band.mesh.positions.every(Number.isFinite));
    }
    assert.ok(!g.makeOrnamentGeometry({...model.config,accent:"none"}).parts.length);
  }
});

test("changing photographed scarf mounts rebuilds the GPU mesh while hardware recoloring reuses it", () => {
  let allocated=0,deleted=0;
  const gl={ARRAY_BUFFER:1,ELEMENT_ARRAY_BUFFER:2,STATIC_DRAW:3,createBuffer:()=>({id:++allocated}),bindBuffer(){},bufferData(){},deleteBuffer(){deleted++;}};
  const renderer={gl,meshes:{}};
  const config=id=>({...models.find(model=>model.id===id).config,accent:"scarf"});
  const navy=config("navy-tall-wood-bow"),rose=config("rose-cream-dark-wood");
  g.ensureOrnamentMeshes(renderer,navy);const first=allocated;
  g.ensureOrnamentMeshes(renderer,{...navy,hardware:"silver"});assert.equal(allocated,first);
  g.ensureOrnamentMeshes(renderer,rose);assert.equal(deleted,first);assert.ok(allocated>first);
  const second=allocated;
  g.ensureOrnamentMeshes(renderer,{...rose,handles:"wood-light"});assert.equal(allocated,second);
  g.ensureOrnamentMeshes(renderer,{...rose,accent:"none"});assert.equal(deleted,allocated);
});
