import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { geometry as g, specs } from "./helpers/fidelity-geometry.mjs";

async function load(path, dependencies = {}, extra = "") {
  const source = (await readFile(new URL(`../${path}`, import.meta.url), "utf8"))
    .replace(/^import[\s\S]*?from "[^"]+";\s*/gm, "");
  const context = { exports: {}, require: createRequire(import.meta.url), ...dependencies };
  runInNewContext(ts.transpileModule(source + extra, { compilerOptions: {
    target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, context);
  return context.exports;
}
const palettes = await load("lib/abags-yarn-palettes.ts");
const references = await load("lib/abags-reference-models.ts");
const cognac = await load("lib/abags-cognac-model.ts");
const families = await load("lib/abags-family-presets.ts", cognac);
const fidelity = await load("lib/abags-builder-fidelity.ts");
const measurements = await load("lib/abags-fidelity-v4-family-spec.ts");
const engine = await load("app/bag-builder-engine.tsx", { ...palettes, ...references, ...fidelity, ...measurements }, "\nexports.BagPreview = BagPreview;");
const mini = { family: "mini", color: "#BA9ECF", stitch: "basket", flap: "crochet", handles: "none", strap: "chain", hardware: "gold", accent: "tassel" };
const mustard = { ...mini, family: "round", color: "#C7962F", stitch: "shell", strap: "woven" };

test("pastel mini has independent left-to-right columns while the wooden tote retains horizontal bands", () => {
  const palette = palettes.getAbagsYarnPalette(mini.color, mini.family);
  assert.equal(palette.axis, "x");
  assert.equal(palette.id, "pastel-mini-columns");
  assert.match(palette.swatch, /90deg/);
  const selected = families.createBagBuilderFamilyConfig("mini");
  assert.equal(palettes.getAbagsYarnPalette(selected.color, selected.family).id, palette.id);
  const stops = palettes.getAbagsYarnSvgStops(mini.color, mini.family);
  assert.equal(stops.length, 8);
  assert.equal(stops[0].color, palette.colors[0]);
  assert.equal(stops.at(-1).color, palette.colors[3]);
  for (const family of ["tote", "tall-tote"]) {
    assert.equal(palettes.getAbagsYarnPalette(mini.color, family).id, "pastel-bands");
    assert.equal(palettes.getAbagsYarnSvgStops(mini.color, family)[0].color, "#F1E9D7");
  }
});

test("rendered yarn columns remain attached to bag width across rotation, height and zoom", () => {
  for (const yaw of [0, .54, Math.PI / 2, Math.PI]) for (const zoom of [.65, 1, 1.4]) {
    const root = g.matrix([0,0,0], [zoom,zoom,zoom], [.21,yaw,0]);
    const frame = g.yarnGradientFrame("mini", root, true);
    assert.equal(frame.min, -specs.mini.rx);
    assert.equal(frame.max, specs.mini.rx);
    for (const y of [-.6, 0, .6]) for (const x of [-.55, 0, .55]) {
      const p = [x,y,.3];
      const world = [0,1,2].map(i=>root[i]*p[0]+root[4+i]*p[1]+root[8+i]*p[2]);
      const value = world.reduce((n,v,i)=>n+v*frame.axis[i],0);
      assert.ok(Math.abs(value-x)<1e-6);
    }
  }
});

test("mustard crochet flap is black and its tassel starts at the actual lowest flap point", () => {
  assert.equal(references.getAbagsCrochetFlapTone(mustard), "#222124");
  assert.equal(references.getAbagsCrochetFlapTone({ ...mustard, color: "#E8DDCC" }), null);
  assert.equal(references.getAbagsCrochetFlapTone({ ...mustard, flap: "none" }), null);
  const surface = g.closedFlapSurface("round", true);
  const tip = surface.contour.reduce((a,b)=>b[1]<a[1]?b:a);
  const anchor = g.fidelityAccessoryAnchor(mustard);
  assert.ok(Math.abs(anchor[0])<.001);
  assert.ok(Math.abs(anchor[1]-tip[1])<1e-6);
  const tassel = g.makeOrnamentGeometry(mustard);
  assert.ok(tassel.bounds.min[1]>specs.round.bodyY-specs.round.ry);
  assert.ok(tassel.bounds.min[0]<0 && tassel.bounds.max[0]>0);
  for (const {mesh} of tassel.parts) assert.ok(mesh.positions.every(Number.isFinite));
});

test("switching mustard to another round color replaces the tassel attachment and releases old buffers", () => {
  let allocated = 0;
  const deleted = new Set();
  const gl = { ARRAY_BUFFER:1, ELEMENT_ARRAY_BUFFER:2, STATIC_DRAW:3,
    createBuffer:()=>({id:++allocated}), bindBuffer(){}, bufferData(){},
    deleteBuffer(buffer){ assert.ok(!deleted.has(buffer)); deleted.add(buffer); } };
  const renderer = { gl, meshes:{} };
  g.ensureOrnamentMeshes(renderer, mustard);
  const centered = renderer.ornamentBounds, before = allocated;
  g.ensureOrnamentMeshes(renderer, { ...mustard, color:"#E8DDCC" });
  assert.equal(deleted.size, before);
  assert.notDeepEqual(renderer.ornamentBounds, centered);
  g.ensureOrnamentMeshes(renderer, mustard);
  assert.deepEqual(renderer.ornamentBounds, centered);
  const current = allocated;
  g.ensureOrnamentMeshes(renderer, { ...mustard, hardware:"silver" });
  assert.equal(allocated, current);
});

test("actual SVG fallback shows vertical mini bands and a black crocheted flap with centered black fringe", () => {
  const render = config => renderToStaticMarkup(createElement(engine.BagPreview, {config}));
  const miniSvg = render(mini);
  assert.match(miniSvg, /id="abags-yarn-ombre"[^>]*x1="160"[^>]*y1="0"[^>]*x2="440"[^>]*y2="0"/);
  const roundSvg = render(mustard);
  assert.match(roundSvg, /fill="url\(#abags-yarn-black-flap\)"/);
  assert.match(roundSvg, /data-layer="accent"[^>]*transform="translate\(-166 90\)"/);
  assert.ok((roundSvg.match(/stroke="#222124"/g)||[]).length>=6);
  assert.doesNotMatch(render({...mustard,flap:"none",accent:"none"}), /data-layer="flap"|data-layer="accent"/);
});
