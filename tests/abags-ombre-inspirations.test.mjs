import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
async function transpiled(path, dependencies = {}) {
  const source = (await read(path)).replace(/^import[\s\S]*?from "[^"]+";\s*/gm, "");
  const context = { exports: {}, ...dependencies };
  runInNewContext(ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText, context);
  return context.exports;
}

const fidelity = await transpiled("lib/abags-builder-fidelity.ts");
const settings = await transpiled("lib/bag-builder-settings.ts", fidelity);
const store = await transpiled("app/bag-builder-config-store.ts");
const sources = await Promise.all([
  read("app/bag-builder-engine.tsx"),
  read("app/bag-builder-fidelity3d.tsx"),
  read("app/bag-builder-reference-experience.tsx"),
  read("app/bag-builder-reference-experience.css"),
  read("app/bag-builder-project-review.tsx"),
]);
const [engine, renderer, inspirations, css, review] = sources;

const palettes = [
  { color: "#C7652F", name: "Miedziany ombré", palette: 1, family: "satchel", flap: "leather-cognac", handles: "leather-braid", strap: "woven-ornament", accent: "none" },
  { color: "#88583F", name: "Brąz ombré", palette: 2, family: "tote", flap: "none", handles: "wood-light", strap: "none", accent: "scarf" },
  { color: "#D58FAA", name: "Róż ombré", palette: 3, family: "tote", flap: "none", handles: "wood-dark", strap: "woven", accent: "scarf" },
  { color: "#BA9ECF", name: "Pastel wielokolorowy", palette: 4, family: "tote", flap: "none", handles: "wood-light", strap: "none", accent: "bow" },
];

test("all four real-world yarn palettes survive save, server validation and order summary", () => {
  for (const item of palettes) {
    const config = {
      family: item.family, color: item.color, stitch: "classic", flap: item.flap,
      handles: item.handles, strap: item.strap, hardware: "gold", accent: item.accent,
    };
    const draft = store.normalizeBagBuilderDraftInput(config);
    assert.deepEqual(JSON.parse(JSON.stringify(draft.invalidKeys)), [], item.name);
    const canonical = settings.normalizeBagBuilderProjectConfig(draft.config);
    assert.deepEqual(JSON.parse(JSON.stringify(canonical)), config, item.name);
    assert.ok(settings.isBagBuilderProjectCompatible(canonical, settings.DEFAULT_BAG_BUILDER_SETTINGS), item.name);
    assert.match(settings.bagBuilderProjectSummary(canonical), new RegExp(item.name, "i"));
    for (const source of [engine, inspirations, review]) {
      assert.ok(source.includes(item.color) && source.includes(item.name), item.name);
    }
    assert.match(renderer, new RegExp(`"${item.color}": ${item.palette}`));
  }
});

test("true yarn dye gradient stays attached to the bag in WebGL and SVG fallback", () => {
  assert.match(renderer, /vYarnHeight=dot\(world\.xyz,uYarnGradientAxis\)/);
  assert.match(renderer, /gl\.uniform2f\(uniforms\.yarnGradientRange/);
  assert.match(renderer, /renderer\.ombrePalette = yarnPalettes\[config\.color\] \?\? 0/);
  assert.match(renderer, /pigment=dyed\*\(uMaterial<6\.5\?\.78:1\.0\)/);
  assert.match(engine, /gradientUnits="userSpaceOnUse"/);
  assert.match(engine, /const yarnBaseFill = yarnStops \? "url\(#abags-yarn-ombre\)" : bagColor/);
});

test("new inspirations refer to genuine Agata photos and use compatible components", async () => {
  const references = await read("lib/exact-customizer-library.ts");
  const pairs = [
    ["brown-ombre-wood-scarf", "brown-ombre"],
    ["pink-ombre-dark-wood", "pink-ombre"],
    ["pastel-tote-wood-bow", "pastel-tote"],
    ["mustard-round-navy-flap", "mustard-round"],
    ["cream-burgundy-flap", "cream-burgundy"],
    ["small-multicolor-chain", "pastel-mini"],
  ];
  for (const [id, preset] of pairs) {
    assert.ok(references.includes(`id:"${id}"`), `Missing photo ${id}`);
    assert.ok(inspirations.includes(`id: "${preset}"`) && inspirations.includes(`referenceId: "${id}"`), preset);
  }
  assert.match(inspirations, /abags:apply-reference-preset/);
  assert.match(engine, /window\.addEventListener\("abags:apply-reference-preset"/);
  assert.doesNotMatch(inspirations, /window\.setTimeout\(resolve, 55\)/);
  assert.doesNotMatch(css, /button:last-child\{display:none\}/);
  assert.match(css, /overflow-x:auto/);
});

test("slowly loaded photo atlas hydrates the existing inspiration cards in place", () => {
  assert.match(inspirations, /function hydrateInspirations\(section: HTMLElement, spriteUrl: string\)/);
  assert.match(inspirations, /hydrateInspirations\(inspirations, spriteUrl\)/);
  assert.match(inspirations, /photo\.dataset\.referenceId === preset\.referenceId/);
  assert.match(inspirations, /photo\.classList\.remove\("is-loading"\)/);
  assert.match(inspirations, /photo\.style\.removeProperty\("--ref-bag"\)/);
  assert.match(inspirations, /if \(!photo \|\| photo\.dataset\.referenceId === preset\.referenceId\) continue/);
});
