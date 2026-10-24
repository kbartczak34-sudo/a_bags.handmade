import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

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
const cognac = await moduleFrom("lib/abags-cognac-model.ts");
const presets = await moduleFrom("lib/abags-family-presets.ts", cognac);
const families = ["tote", "round", "bucket", "mini", "satchel"];

test("every Fason has a complete supported client and server configuration", () => {
  assert.deepEqual(Object.keys(presets.ABAGS_FAMILY_PRESETS).sort(), [...families].sort());
  for (const family of families) {
    const config = presets.createBagBuilderFamilyConfig(family);
    assert.equal(config.family, family);
    assert.equal(Object.keys(config).length, 8);
    const draft = store.normalizeBagBuilderDraftInput(config);
    assert.deepEqual(plain(draft.invalidKeys), [], family);
    assert.deepEqual(plain(draft.config), plain(config), family);
    assert.ok(store.isBagBuilderDraftConfigComplete(draft.config), family);
    const canonical = settings.normalizeBagBuilderProjectConfig(config);
    assert.deepEqual(plain(canonical), plain(config), family);
    assert.ok(settings.isBagBuilderProjectCompatible(canonical, settings.DEFAULT_BAG_BUILDER_SETTINGS), family);
    assert.ok(fidelity.isAgataBuilderHandleSupported(family, config.handles), family);
    for (const [key, value] of [["flaps", config.flap], ["straps", config.strap], ["accents", config.accent]]) {
      assert.ok(fidelity.isAgataBuilderConstructionSupported(family, key, value), `${family} ${key}`);
    }
  }
});

test("editable family configurations never mutate a preset or the cognac reference", () => {
  for (const family of families) {
    const first = presets.createBagBuilderFamilyConfig(family);
    const second = presets.createBagBuilderFamilyConfig(family);
    assert.notEqual(first, second);
    first.color = "#222124";
    first.flap = "none";
    first.handles = "none";
    assert.deepEqual(plain(presets.createBagBuilderFamilyConfig(family)), plain(second));
  }
  assert.deepEqual(plain(presets.createBagBuilderFamilyConfig("satchel")), plain(cognac.ABAGS_COGNAC_PRESET));
});

const engine = await readFile(new URL("../app/bag-builder-engine.tsx", import.meta.url), "utf8");
function engineUpdate() {
  const empty = { family: "", color: "", stitch: "", flap: "none", handles: "none", strap: "none", hardware: "gold", accent: "none" };
  let config = { ...empty }, saved = true;
  const context = { exports: {}, EMPTY: empty, ...presets,
    setConfig: update => { config = update(config); },
    setSaved: value => { saved = value; },
  };
  const source = engine.slice(engine.indexOf("  const update ="), engine.indexOf("  const completed ="));
  runInNewContext(ts.transpileModule(`${source}\nexports.update = update;`, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText, context);
  return { update: context.exports.update, state: () => plain(config), saved: () => saved, empty };
}

test("one actual engine family update replaces all eight fields and leaves later edits independent", () => {
  const engine = engineUpdate();
  assert.deepEqual(engine.state(), engine.empty);
  for (const family of ["satchel", ...families, "round", "tote"]) {
    engine.update("family", family);
    assert.deepEqual(engine.state(), plain(presets.createBagBuilderFamilyConfig(family)));
    assert.equal(engine.saved(), false);
    const beforeEdit = engine.state();
    engine.update("color", "#275C4A");
    assert.deepEqual(engine.state(), { ...beforeEdit, color: "#275C4A" });
  }
});

test("clearing the family returns the empty construction without selecting a model", () => {
  const engine = engineUpdate();
  engine.update("family", "satchel");
  engine.update("family", "");
  assert.deepEqual(engine.state(), engine.empty);
});
