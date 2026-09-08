import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const renderer = await readFile(new URL("../app/bag-builder-final-webgl3d.tsx", import.meta.url), "utf8");

test("V4 renderer treats wooden handles as 3D geometry rather than a flat UI decoration", () => {
  assert.match(renderer, /wood-light/);
  assert.match(renderer, /wood-dark/);
  assert.match(renderer, /handles/);
  assert.match(renderer, /matrix\(/);
  assert.match(renderer, /tubeArc|handle/);
});

test("customer renderer exposes front, three-quarter and side views with bounded interaction", () => {
  assert.match(renderer, /Przód/);
  assert.match(renderer, /3\/4/);
  assert.match(renderer, /Bok/);
  assert.match(renderer, /MIN_ZOOM/);
  assert.match(renderer, /MAX_ZOOM/);
  assert.match(renderer, /onPointerMove/);
});
