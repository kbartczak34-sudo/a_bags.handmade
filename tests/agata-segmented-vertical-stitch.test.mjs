import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const renderer = await readFile(
  new URL("../app/bag-builder-agata-cord-webgl.tsx", import.meta.url),
  "utf8",
);

test("vertical-open stitch uses short interlocked cord segments instead of a continuous printed post", () => {
  assert.match(renderer, /vec2 agataVerticalOpen\(vec2 uv\)/);
  assert.match(renderer, /float leftEntry=sdSegment/);
  assert.match(renderer, /float rightEntry=sdSegment/);
  assert.match(renderer, /float crossingLeft=sdSegment/);
  assert.match(renderer, /float crossingRight=sdSegment/);
  assert.match(renderer, /float leftReturn=sdSegment/);
  assert.match(renderer, /float rightReturn=sdSegment/);
  assert.doesNotMatch(renderer, /float post=roundedCord\(abs\(q\.x\)/);
});

test("segmented stitch keeps deterministic handmade drift and explicit negative space", () => {
  assert.match(renderer, /float cellJitter=/);
  assert.match(renderer, /float rowJitter=/);
  assert.match(renderer, /float negativeSpace=/);
  assert.match(renderer, /float cavity=\(1\.0-cord\)/);
  assert.doesNotMatch(renderer, /Math\.random/);
  assert.doesNotMatch(renderer, /setInterval/);
  assert.doesNotMatch(renderer, /readPixels/);
});
