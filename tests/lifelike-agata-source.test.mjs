import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../app/bag-builder-lifelike-surface.tsx", import.meta.url),
  "utf8",
);

test("lifelike photographic pass prefers the verified Agata material canvas", () => {
  assert.match(source, /const AGATA_SOURCE_SELECTOR = "\.abags-agata-cord-webgl"/);
  assert.match(source, /stage\.dataset\.abagsAgataCordWebgl === AGATA_SURFACE_VERSION/);
  assert.match(source, /layer\.querySelector<HTMLCanvasElement>\(AGATA_SOURCE_SELECTOR\)/);
  assert.match(source, /agata-webgl-photo-calibrated/);
});

test("base Fidelity canvas remains a deterministic fallback before Agata handoff", () => {
  assert.match(source, /const BASE_SOURCE_SELECTOR = "\.abags-fidelity3d-canvas"/);
  assert.match(source, /layer\.querySelector<HTMLCanvasElement>\(BASE_SOURCE_SELECTOR\)/);
  assert.match(source, /calibrated-webgl-v4/);
});

test("lifelike pass clears itself in Photo-True and repaints when material ownership changes", () => {
  assert.match(source, /stage\.dataset\.abagsPhotoTrue === "active"/);
  assert.match(source, /"data-abags-agata-cord-webgl"/);
  assert.match(source, /"data-abags-photo-true"/);
  assert.match(source, /stage\.removeAttribute\("data-abags-lifelike-source"\)/);
});
