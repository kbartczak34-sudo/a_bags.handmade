import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("live builder mounts the shared view synchronizer", async () => {
  const source = await read("app/exact-live-customizer.tsx");
  assert.match(source, /BagBuilderViewSync/);
  assert.match(source, /<BagBuilderViewSync\s*\/>/);
});

test("plus and minus controls propagate their real React range value to visual passes", async () => {
  const source = await read("app/bag-builder-view-sync.tsx");
  assert.match(source, /Oddal model/);
  assert.match(source, /Przybliż model/);
  assert.match(source, /requestAnimationFrame/);
  assert.match(source, /abags-pro3d-zoom/);
  assert.match(source, /abags-canvas3d-zoom/);
  assert.match(source, /dispatchEvent\(new Event\("input"/);
});
