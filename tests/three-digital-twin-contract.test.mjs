import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const registry = await readFile(new URL("../lib/abags-three-model-registry.ts", import.meta.url), "utf8");
const enhancer = await readFile(new URL("../app/bag-builder-3d-enhancer.tsx", import.meta.url), "utf8");
const pbr = await readFile(new URL("../lib/abags-three-pbr.ts", import.meta.url), "utf8");

for (const family of ["tote", "round", "bucket", "mini"]) {
  test(`Three model registry maps ${family} to immutable v1 asset id`, () => {
    assert.match(registry, new RegExp(`if \\(family === "${family}"\\) return "abags-${family}-v1"`));
  });
}

test("Digital Twin requires the complete production asset set before activating", () => {
  assert.match(enhancer, /REQUIRED_ASSET_KEYS = \["model", "basecolor", "normal", "roughness", "metallic", "ao"\]/);
  assert.match(enhancer, /if \(!\(await assetsExist\(urls\)\)\)/);
});

test("Three renderer uses bundled Three.js modules and a local RoomEnvironment", () => {
  assert.match(enhancer, /import\("three"\)/);
  assert.match(enhancer, /three\/addons\/environments\/RoomEnvironment\.js/);
  assert.doesNotMatch(enhancer, /cdn\.jsdelivr\.net/);
});

test("PBR texture pipeline keeps basecolor in sRGB and data maps in NoColorSpace", () => {
  assert.match(pbr, /texture\.colorSpace = THREE\.SRGBColorSpace/);
  assert.match(pbr, /texture\.colorSpace = THREE\.NoColorSpace/);
  assert.match(pbr, /loadABagsThreePbrMaps/);
});

test("Three renderer has an explicit production fallback path", () => {
  assert.match(enhancer, /data-abags-three-fallback/);
  assert.match(enhancer, /assets-missing/);
  assert.match(enhancer, /load-failed/);
});
