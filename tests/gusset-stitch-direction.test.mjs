import assert from "node:assert/strict";
import test from "node:test";
import { geometry as g, specs } from "./helpers/fidelity-geometry.mjs";

function loops(mesh, minimumSegments = 4) {
  const groups=new Map();
  for(const span of mesh.cordOccluders) {
    if(!groups.has(span.owner))groups.set(span.owner,[]);
    groups.get(span.owner).push(span);
  }
  return [...groups.entries()].filter(([,spans])=>spans.length>=minimumSegments&&spans.length<=20).map(([owner,spans])=>{
    const points=[spans[0].a,...spans.map(span=>span.b)];
    const mean=[0,1,2].map(axis=>points.reduce((sum,p)=>sum+p[axis],0)/points.length);
    const low=[0,1,2].map(axis=>Math.min(...points.map(p=>p[axis])));
    const high=[0,1,2].map(axis=>Math.max(...points.map(p=>p[axis])));
    return {owner,spans,points,mean,low,high};
  });
}
const quantile=(values,fraction)=>values.sort((a,b)=>a-b)[Math.round((values.length-1)*fraction)];
const stitches=["classic","herringbone","shell"];
// Short return stitches support the classic V but are not upright loops.
const uprightLoops = (mesh, stitch) => loops(mesh, stitch === "classic" ? 5 : 4);

test("V and fan loops point toward the base on both sidewalls of every bag family", () => {
  for(const [family,spec] of Object.entries(specs))for(const stitch of stitches) {
    const candidates=uprightLoops(g.makeCrochetGusset(family,stitch),stitch)
      .filter(p=>Math.abs(p.mean[0])>spec.rx*.82&&Math.abs(p.mean[1])<spec.ry*.30&&Math.abs(p.mean[2])<g.depthAt(family,0)*.25);
    for(const side of [-1,1]) {
      const selected=candidates.filter(p=>p.mean[0]*side>0);
      assert.ok(selected.length>=2,`${family}/${stitch}/${side}: representative whole loops must be present`);
      for(const loop of selected) {
        const shoulders=Math.min(loop.points[0][1],loop.points.at(-1)[1]);
        assert.ok(shoulders-loop.low[1]>spec.rx*5/160,`${family}/${stitch}/${side}: the loop is sideways or upside down`);
      }
    }
  }
});

test("sidewall stitch height and width remain at the same physical gauge as the front", () => {
  for(const [family,spec] of Object.entries(specs))for(const stitch of stitches) {
    const front=uprightLoops(g.makeCrochetPanel(family,stitch),stitch)
      .filter(p=>Math.abs(p.mean[0])<spec.rx*.4&&Math.abs(p.mean[1])<spec.ry*.3);
    const side=uprightLoops(g.makeCrochetGusset(family,stitch),stitch)
      .filter(p=>Math.abs(p.mean[0])>spec.rx*.82&&Math.abs(p.mean[1])<spec.ry*.3&&Math.abs(p.mean[2])<g.depthAt(family,0)*.25);
    assert.ok(front.length&&side.length,`${family}/${stitch}: enough textile to compare`);
    // Shell has a broad outer fan and a smaller inner loop; compare both
    // size classes rather than medians that can fall in different classes.
    for(const fraction of stitch==="shell"?[.15,.85]:[.5]) {
      const height=quantile(side.map(p=>p.high[1]-p.low[1]),fraction)/quantile(front.map(p=>p.high[1]-p.low[1]),fraction);
      const width=quantile(side.map(p=>p.high[2]-p.low[2]),fraction)/quantile(front.map(p=>p.high[0]-p.low[0]),fraction);
      assert.ok(height>.8&&height<1.2,`${family}/${stitch}: height ratio ${height}`);
      assert.ok(width>.7&&width<1.3,`${family}/${stitch}: width ratio ${width}`);
    }
  }
});

test("reoriented sidewall loops retain genuinely round nominal 5 mm cord", () => {
  for(const [family,spec] of Object.entries(specs)) {
    const mesh=g.makeCrochetGusset(family,"classic"),radius=spec.rx*5/160;
    const selected=loops(mesh).filter(p=>Math.abs(p.mean[0])>spec.rx*.82&&Math.abs(p.mean[1])<spec.ry*.3&&Math.abs(p.mean[2])<g.depthAt(family,0)*.25);
    assert.ok(selected.length>0);
    for(const loop of selected) {
      assert.ok(loop.spans.every(span=>Math.abs(span.radius-radius)<1e-12));
      const ring=Array.from({length:8},(_,i)=>mesh.positions.slice((loop.owner+i)*3,(loop.owner+i+1)*3));
      for(let i=0;i<4;i++) {
        const diameter=Math.hypot(...ring[i].map((n,axis)=>n-ring[i+4][axis]));
        assert.ok(diameter>radius*2*.92&&diameter<radius*2*1.08,`${family}: cord became stretched across its section`);
      }
    }
  }
});
