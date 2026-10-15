import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const source = await readFile(new URL("../app/bag-builder-lifelike-surface.tsx", import.meta.url), "utf8");
test("the flat Agata legacy renderer never takes ownership of the final customer 3D image", () => {
  assert.match(source,/const BASE_SOURCE_SELECTOR = "\.abags-fidelity3d-canvas"/);
  assert.match(source,/function selectMaterialSource\(layer: HTMLElement\)/);
  assert.match(source,/layer\.querySelector<HTMLCanvasElement>\(BASE_SOURCE_SELECTOR\)/);
  assert.match(source,/calibrated-webgl-v4/);
  assert.doesNotMatch(source,/AGATA_SOURCE_SELECTOR|AGATA_SURFACE_VERSION|agata-webgl-photo-calibrated/);
});
test("material redraw tracks live config without replacing the 3D camera", () => {
  assert.match(source,/stage\.dataset\.abagsPhotoTrue === "active"/);
  assert.match(source,/"data-abags-agata-cord-webgl"/);
  assert.match(source,/"data-abags-photo-true"/);
  assert.match(source,/stage\.removeAttribute\("data-abags-lifelike-source"\)/);
});
