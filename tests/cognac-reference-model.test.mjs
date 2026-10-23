import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { geometry, specs } from "./helpers/fidelity-geometry.mjs";

async function moduleFrom(path, globals = {}) {
  const source = (await readFile(new URL(`../${path}`, import.meta.url), "utf8"))
    .replace(/^import[\s\S]*?from "[^"]+";\s*/gm, "");
  const context = { exports: {}, ...globals };
  runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText, context);
  return context.exports;
}
const plain = value => JSON.parse(JSON.stringify(value));
const fidelity = await moduleFrom("lib/abags-builder-fidelity.ts");
const settings = await moduleFrom("lib/bag-builder-settings.ts", fidelity);
const store = await moduleFrom("app/bag-builder-config-store.ts");
const reference = await moduleFrom("lib/abags-cognac-model.ts");
const preset = reference.ABAGS_COGNAC_PRESET;

test("reference preset survives client draft, server validation, project identity and summary", () => {
  const draft = store.normalizeBagBuilderDraftInput(preset);
  assert.deepEqual(plain(draft.invalidKeys), []);
  assert.deepEqual(plain(draft.config), plain(preset));
  assert.ok(store.isBagBuilderDraftConfigComplete(draft.config));
  const canonical = settings.normalizeBagBuilderProjectConfig(draft.config);
  assert.deepEqual(plain(canonical), plain(preset));
  assert.ok(settings.isBagBuilderProjectCompatible(canonical, settings.DEFAULT_BAG_BUILDER_SETTINGS));
  assert.match(settings.bagBuilderProjectSummary(canonical), /Kuferek koniakowy/);
  assert.match(settings.bagBuilderProjectSummary(canonical), /[Oo]mbré/);
  const code = settings.bagBuilderProjectCode(canonical);
  for (const key of ["handles", "strap", "flap"]) {
    assert.notEqual(settings.bagBuilderProjectCode({ ...canonical, [key]: "none" }), code);
  }
});

test("existing owner settings migrate the fifth family without inventing a price or product", () => {
  const migrated = settings.normalizeBagBuilderSettings({ pricingEnabled: true, familyBaseCents: { tote: 25000 }, familyProductIds: { tote: "existing-tote" } });
  assert.equal(migrated.familyBaseCents.tote, 25000);
  assert.equal(migrated.familyProductIds.tote, "existing-tote");
  assert.equal(migrated.familyBaseCents.satchel, null);
  assert.equal(migrated.familyProductIds.satchel, null);
  assert.equal(settings.calculateBagBuilderProjectCents(preset, migrated), null);
  assert.ok(settings.isBagBuilderProjectCompatible(preset, migrated));
  for (const [key, unsupported] of [["handles", "wood-light"], ["strap", "chain"], ["flap", "crochet"], ["accent", "scarf"]]) {
    assert.equal(settings.isBagBuilderProjectCompatible({ ...preset, [key]: unsupported }, migrated), false);
  }
});

const parts = geometry.makeCognacConstruction();
test("new leather, stitches, lock, rings and engraved badge are finite indexed WebGL geometry", () => {
  assert.equal(new Set(parts.map(p => p.name)).size, parts.length);
  for (const { name, mesh } of parts) {
    const vertices = mesh.positions.length / 3;
    assert.ok(vertices > 10 && vertices < 65536, `${name} unsigned-short budget`);
    assert.equal(mesh.normals.length, mesh.positions.length);
    assert.equal(mesh.uvs.length, vertices * 2);
    assert.equal(mesh.indices.length % 3, 0);
    for (const values of [mesh.positions, mesh.normals, mesh.uvs]) assert.ok(values.every(Number.isFinite), name);
    assert.ok(mesh.indices.every(i => Number.isInteger(i) && i >= 0 && i < vertices), name);
    for (let i = 0; i < mesh.normals.length; i += 3) assert.ok(Math.abs(Math.hypot(...mesh.normals.slice(i, i + 3)) - 1) < .001, `${name} unit normal`);
  }
  for (const section of ["handle", "flap", "badge"]) assert.ok(parts.some(p => p.section === section && p.tone === "metal"));
});

test("braided handle sags onto the fitted flap and has alternating separated leather crossings", () => {
  const a = geometry.cognacHandlePoint(0), b = geometry.cognacHandlePoint(1), middle = geometry.cognacHandlePoint(.5);
  assert.ok(a[1] - middle[1] > .27 && b[1] - middle[1] > .27);
  assert.ok(Math.abs(a[0] + b[0]) < 1e-6);
  const surface = geometry.closedFlapSurface("satchel", false);
  for (let i = 1; i < 144; i++) {
    const t = i / 144;
    const lanes = [0, 1, 2].map(lane => geometry.cognacHandlePoint(t, lane));
    for (const point of lanes) {
      const seat = surface.sample(point[0], point[1]);
      if (seat) assert.ok(point[2] - seat.z > .015, "leather strand above flap");
    }
    for (let lane = 0; lane < 3; lane++) assert.ok(Math.hypot(...lanes[lane].map((n,j) => n - lanes[(lane + 1) % 3][j])) > .015, "no coincident crossing strands");
  }
});

test("small gold plates do not bury the physical engraved lettering", () => {
  const plate = geometry.makeCognacPlate(geometry.roundedRectangle(.32, .085, .034), .009);
  assert.ok(Math.max(...plate.positions.filter((_,i) => i % 3 === 2)) < .006);
  const metal = parts.find(p => p.section === "badge" && p.tone === "metal").mesh;
  const letters = parts.find(p => p.section === "badge" && p.tone === "engraving").mesh;
  const z = mesh => mesh.positions.filter((_,i) => i % 3 === 2);
  assert.ok(Math.min(...z(letters)) > Math.min(...z(metal)) + .012);
  assert.ok(letters.indices.length > 1000, "both labels are real geometry");
});

test("ornamental strap routes behind the body, hangs beside it and meets both clasp anchors", () => {
  const spec = specs.satchel, span = spec.rx * spec.attachmentWidthFactor;
  for (const t of [0, 1]) {
    const point = geometry.ornamentStrapPoint("satchel", t);
    assert.ok(Math.abs(point[0] - (t ? span : -span)) < 1e-6);
    assert.ok(Math.abs(point[1]) < 1e-6 && Math.abs(point[2]) < 1e-6);
  }
  const path = Array.from({ length: 85 }, (_,i) => geometry.ornamentStrapPoint("satchel", i / 84));
  assert.ok(Math.min(...path.map(p => p[2])) < -.8);
  assert.ok(Math.max(...path.map(p => p[0])) > spec.rx + .25);
  assert.ok(Math.min(...path.map(p => p[1])) < -1.4);
  const band = geometry.familyShoulderStrapMesh("satchel", "ornament");
  for (let i = 1; i <= 84; i++) {
    const distance = Math.hypot(...path[i].map((n,j) => n - path[i - 1][j]));
    const uvDistance = band.uvs[i * 26] - band.uvs[(i - 1) * 26];
    assert.ok(Math.abs(uvDistance * .32 - distance) < 1e-6, "motif size follows physical distance");
  }
  assert.equal(geometry.makeShoulderBandGeometry("satchel", "ornament").parts[0].material, 12);
});

test("ombré height remains in bag coordinates through camera rotation and zoom", () => {
  for (const zoom of [.34, .92, 1.45]) for (const yaw of [-2, -.62, 0, 1.5]) for (const pitch of [-.4, .6]) {
    const root = geometry.matrix([0,0,0], [zoom,zoom,zoom], [pitch,yaw,0]);
    const length = root[4] ** 2 + root[5] ** 2 + root[6] ** 2;
    const axis = [root[4],root[5],root[6]].map(n => n / length);
    const local = [.43, -.27, .38];
    const world = [0,1,2].map(i => root[i] * local[0] + root[4 + i] * local[1] + root[8 + i] * local[2]);
    assert.ok(Math.abs(world.reduce((n,p,i) => n + p * axis[i], 0) - local[1]) < 1e-6);
  }
});
