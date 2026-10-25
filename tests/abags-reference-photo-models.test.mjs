import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { geometry, specs } from "./helpers/fidelity-geometry.mjs";

const plain = value => JSON.parse(JSON.stringify(value));
async function moduleFrom(path, globals = {}) {
  const source = (await readFile(new URL(`../${path}`, import.meta.url), "utf8"))
    .replace(/^import[\s\S]*?from "[^"]+";\s*/gm, "");
  const context = { exports: {}, ...globals };
  runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText, context);
  return context.exports;
}
const fidelity = await moduleFrom("lib/abags-builder-fidelity.ts");
const settings = await moduleFrom("lib/bag-builder-settings.ts", fidelity);
const store = await moduleFrom("app/bag-builder-config-store.ts");
const reference = await moduleFrom("lib/abags-reference-models.ts");
const palettes = await moduleFrom("lib/abags-yarn-palettes.ts");
const models = reference.ABAGS_REFERENCE_MODELS;

function assertMesh(mesh, label) {
  const count = mesh.positions.length / 3;
  assert.ok(count > 2 && count <= 65535, `${label}: portable WebGL vertex budget`);
  assert.equal(mesh.normals.length, mesh.positions.length, label);
  assert.equal(mesh.uvs.length, count * 2, label);
  assert.equal(mesh.indices.length % 3, 0, label);
  for (const values of [mesh.positions, mesh.normals, mesh.uvs]) assert.ok(values.every(Number.isFinite), label);
  assert.ok(mesh.indices.every(i => Number.isInteger(i) && i >= 0 && i < count), label);
  for (let i = 0; i < mesh.normals.length; i += 3) assert.ok(Math.abs(Math.hypot(...mesh.normals.slice(i,i+3)) - 1) < .001, `${label}: unit normal`);
}

test("six supplied references create complete compatible projects that survive save and restore", () => {
  assert.deepEqual(plain(models.map(model => model.sourceFile).sort()), ["1000019763.png","1000019645.png","1000019552.jpg","1000019407.png","1000019121.jpg","1000018863.jpg"].sort());
  for (const model of models) {
    const config = reference.createAbagsReferenceModelConfig(model.id);
    const restored = JSON.parse(JSON.stringify(config));
    const draft = store.normalizeBagBuilderDraftInput(restored);
    assert.deepEqual(plain(draft.invalidKeys), [], model.id);
    assert.deepEqual(plain(draft.config), plain(model.config), model.id);
    assert.ok(store.isBagBuilderDraftConfigComplete(draft.config), model.id);
    const canonical = settings.normalizeBagBuilderProjectConfig(draft.config);
    assert.deepEqual(plain(canonical), plain(model.config), model.id);
    assert.ok(settings.isBagBuilderProjectCompatible(canonical, settings.DEFAULT_BAG_BUILDER_SETTINGS), model.id);
    assert.equal(reference.getAbagsReferenceModel(canonical).id, model.id);
    const summary = settings.bagBuilderProjectSummary(canonical);
    assert.doesNotMatch(summary, /undefined|crochet-braid|woven-floral|woven-striped|chain-leather/);
  }
});

test("reference copies remain independent and legacy owner settings invent no new price or product", () => {
  const migrated = settings.normalizeBagBuilderSettings({pricingEnabled:true,familyBaseCents:{tote:25000}});
  for (const family of ["tall-tote","shoulder"]) {
    assert.equal(migrated.familyBaseCents[family], null);
    assert.equal(migrated.familyProductIds[family], null);
  }
  for (const model of models) {
    const first = reference.createAbagsReferenceModelConfig(model.id);
    first.color = "#222124";
    assert.deepEqual(plain(reference.createAbagsReferenceModelConfig(model.id)), plain(model.config));
    assert.equal(settings.calculateBagBuilderProjectCents(model.config, migrated), null);
  }
  assert.equal(reference.createAbagsReferenceModelConfig("unknown"), null);
});

test("tall and shoulder silhouettes have separate proportions and valid closed-depth textile meshes", () => {
  assert.ok(specs["tall-tote"].ry / specs["tall-tote"].rx > 1);
  assert.ok(specs.shoulder.rx / specs.shoulder.ry > 1.3);
  for (const family of ["tall-tote","shoulder"]) {
    assertMesh(geometry.makeVariableDepthBody(family), `${family} body`);
    for(const stitch of ["classic","herringbone","basket","shell"]){
      assertMesh(geometry.makeCrochetPanel(family,stitch), `${family} ${stitch} stitches`);
      assertMesh(geometry.makeCrochetGusset(family,stitch), `${family} ${stitch} sides`);
    }
  }
});

test("flat wooden rings retain an open centre and broad faces through real depth", () => {
  const mesh = geometry.makeReferenceWoodHandle();
  assertMesh(mesh,"wooden ring");
  const z = mesh.positions.filter((_,i)=>i%3===2);
  assert.ok(Math.abs(Math.max(...z)-.026)<1e-6 && Math.abs(Math.min(...z)+.026)<1e-6);
  assert.ok(mesh.normals.filter((_,i)=>i%3===2).filter(n=>Math.abs(n)>.99).length > 100);
  for (let i=0;i<mesh.positions.length;i+=3) {
    assert.ok(Math.hypot(mesh.positions[i]/.46,mesh.positions[i+1]/.42)>.85,"wood never fills the handle opening");
  }
});

test("photographic wood tones follow reference models while preserving the customer's handle selection", () => {
  const wooden = models.filter(model => model.config.handles.startsWith("wood"));
  assert.equal(new Set(wooden.map(model => reference.getAbagsWoodHandleTone(model.config))).size, wooden.length);
  for (const model of wooden) {
    const opposite = model.config.handles === "wood-light" ? "wood-dark" : "wood-light";
    const custom = { ...model.config, handles: opposite };
    const generic = { ...custom, color: "#123456" };
    assert.equal(reference.getAbagsWoodHandleTone(custom), reference.getAbagsWoodHandleTone(generic));
    for (const handles of ["none", "crochet", "leather-braid"]) {
      assert.equal(reference.getAbagsWoodHandleTone({ ...model.config, handles }), null);
    }
  }
  assert.equal(reference.getAbagsWoodHandleTone(models[0].config), null);
});

test("all reference badges and shoulder zipper parts are physical indexed geometry", () => {
  for (const model of models) {
    const parts = geometry.makeReferenceConstruction(model.config);
    for (const part of parts) assertMesh(part.mesh,`${model.id}/${part.tone}`);
    assert.ok(parts.some(part=>part.tone==="engraving"&&part.mesh.indices.length>100));
    assert.equal(parts.some(part=>part.tone==="zipper"), model.config.family==="shoulder");
  }
});

test("crochet, floral, striped and mixed leather-chain straps meet both clasps and stay above the ground", () => {
  for (const [family,kind] of [["shoulder","crochet"],["tall-tote","floral"],["tall-tote","striped"],["tall-tote","chain-leather"]]) {
    const spec=specs[family],span=spec.rx*spec.attachmentWidthFactor;
    for(const t of [0,1]) {
      const frame=geometry.shoulderBandFrame(family,t,kind);
      assert.ok(Math.abs(frame.center[0]-(t?span:-span))<1e-6);
      assert.ok(Math.abs(frame.center[1])<1e-6&&Math.abs(frame.center[2])<1e-6);
    }
    const data=geometry.makeShoulderBandGeometry(family,kind);
    for(const part of data.parts) assertMesh(part.mesh,`${family}/${kind}/${part.name}`);
    assert.ok(data.bounds.min[1] >= spec.bodyY-spec.ry-.15,`${kind} must not hang through the bag's ground plane`);
    if(kind==="chain-leather") {
      assert.ok(data.parts.some(part=>part.material===2));
      assert.ok(data.parts.some(part=>part.tone==="metal"&&part.mesh.indices.length>1000));
    }
  }
});

test("large reference bows retain folded faces, long tails and body clearance", () => {
  for(const model of models) {
    const data=geometry.makeOrnamentGeometry(model.config);
    assert.ok(data.bounds.max[0]-data.bounds.min[0]>.75,model.id);
    assert.ok(data.bounds.max[1]-data.bounds.min[1]>.9,model.id);
    for(const part of data.parts) assertMesh(part.mesh,`${model.id}/${part.name}`);
  }
});

test("reference bows retain individually calibrated folds and tails instead of reusing the scarf", () => {
  const silhouettes = new Set();
  for (const model of models) {
    const bow = geometry.makeOrnamentGeometry(model.config);
    const scarf = geometry.makeOrnamentGeometry({...model.config,accent:"scarf"});
    silhouettes.add(JSON.stringify(bow.bounds));
    assert.notDeepEqual(plain(bow.bounds), plain(scarf.bounds), model.id);
    assert.ok(bow.bounds.min[1] > specs[model.config.family].bodyY-specs[model.config.family].ry,
      `${model.id}: falling fabric must not pass through the ground`);
  }
  assert.equal(silhouettes.size, models.length);
});

test("switching reference colors rebuilds their bow geometry and frees its former GPU buffers", () => {
  let allocated=0;
  const deleted=new Set(),gl={ARRAY_BUFFER:1,ELEMENT_ARRAY_BUFFER:2,STATIC_DRAW:3,
    createBuffer:()=>({id:++allocated}),bindBuffer(){},bufferData(){},
    deleteBuffer(buffer){assert.ok(!deleted.has(buffer));deleted.add(buffer);}};
  const renderer={gl,meshes:{}};
  for(const model of models.filter(m=>m.config.family==="tall-tote")) {
    const previous=allocated;
    geometry.ensureOrnamentMeshes(renderer,model.config);
    assert.equal(deleted.size,previous,model.id);
    const current=allocated;
    geometry.ensureOrnamentMeshes(renderer,{...model.config,hardware:"silver"});
    assert.equal(allocated,current,"metal recoloring reuses the same fabric geometry");
  }
  geometry.ensureOrnamentMeshes(renderer,{...models[1].config,accent:"none"});
  assert.equal(deleted.size,allocated);
});

test("printed strap adjusters follow the actual webbing frame and keep both slots open", () => {
  for(const kind of ["floral","striped","ornament","woven"]) {
    const data=geometry.makeShoulderBandGeometry("tall-tote",kind);
    const adjuster=data.parts.find(part=>part.name==="shoulderBandAdjuster");
    assert.ok(adjuster && adjuster.tone==="metal");
    assertMesh(adjuster.mesh,kind);
    const f=geometry.shoulderBandFrame("tall-tote",.90,kind);
    const local=[];
    for(let i=0;i<adjuster.mesh.positions.length;i+=3) {
      const offset=adjuster.mesh.positions.slice(i,i+3).map((n,j)=>n-f.center[j]);
      local.push([f.widthAxis,f.tangent,f.normal].map(axis=>axis.reduce((sum,n,j)=>sum+n*offset[j],0)));
    }
    assert.ok(Math.max(...local.map(p=>p[0]))>f.halfWidth);
    assert.ok(Math.min(...local.map(p=>p[0])) < -f.halfWidth);
    for(let i=0;i<adjuster.mesh.indices.length;i+=3) {
      const center=[0,1,2].map(axis=>adjuster.mesh.indices.slice(i,i+3).reduce((sum,index)=>sum+local[index][axis]/3,0));
      assert.ok(center[2]>f.halfThickness,"slider seats on the webbing face");
      assert.ok(!(Math.abs(center[0])<f.halfWidth*.65&&Math.abs(center[1])>.020&&Math.abs(center[1])<.045),
        "solid metal must not fill either opening");
    }
  }
});

test("reference dye ramps and SVG fallback preserve cream tops and the four separate pastel bands", () => {
  assert.equal(palettes.ABAGS_YARN_PALETTES.length,4);
  for(const palette of palettes.ABAGS_YARN_PALETTES) {
    assert.ok(palette.colors.every(color=>/^#[A-F\d]{6}$/.test(color)));
    const stops=palettes.getAbagsYarnSvgStops(palette.color);
    assert.equal(stops[0].color,palette.colors.at(-1));
    assert.equal(stops.at(-1).color,palette.colors[0]);
    assert.ok(stops.every((stop,i)=>i===0||stop.offset>=stops[i-1].offset));
  }
  const bands=palettes.getAbagsYarnSvgStops("#BA9ECF");
  assert.equal(new Set(bands.map(stop=>stop.color)).size,4);
  assert.equal(bands.length,8);
  assert.ok(bands.some((stop,i)=>i>0&&stop.offset===bands[i-1].offset&&stop.color!==bands[i-1].color));
  assert.equal(palettes.getAbagsYarnSvgStops("#222124"),null);
});

test("yarn height is invariant under every new model's camera rotation and fitted zoom", () => {
  for(const family of ["tall-tote","shoulder"])for(const zoom of [.34,.92,1.45])for(const yaw of [-1.8,-.62,0,1.5])for(const pitch of [-.4,.55]) {
    const fitted=zoom*(family==="tall-tote"?.86:1),root=geometry.matrix([0,0,0],[fitted,fitted,fitted],[pitch,yaw,0]);
    const axis=[root[4],root[5],root[6]],length=axis.reduce((n,v)=>n+v*v,0);
    for(const height of [.12,.38,.64,.90]) {
      const spec=specs[family],point=[spec.rx*.34,spec.bodyY+(height*2-1)*spec.ry,.31];
      const world=[0,1,2].map(i=>root[i]*point[0]+root[4+i]*point[1]+root[8+i]*point[2]);
      assert.ok(Math.abs(world.reduce((n,v,i)=>n+v*axis[i]/length,0)-point[1])<1e-6);
    }
  }
});

test("generated model thumbnails are labelled as 3D previews and real photographs use existing atlas cells", async () => {
  const library=await moduleFrom("lib/exact-customizer-library.ts");
  for(const model of models) {
    if(model.referenceId) assert.ok(library.EXACT_ATELIER_LIBRARY.some(item=>item.id===model.referenceId),model.id);
    else {
      const png=await readFile(new URL(`../public${model.image}`,import.meta.url));
      assert.equal(png.subarray(1,4).toString(),"PNG");
      assert.equal(png.readUInt32BE(16),360);
      assert.equal(png.readUInt32BE(20),360);
    }
  }
  const source=await readFile(new URL("../app/bag-builder-reference-experience.tsx",import.meta.url),"utf8");
  assert.match(source,/element\.dataset\.referenceKind = modelPreview \? "model-3d" : "photograph"/);
});
