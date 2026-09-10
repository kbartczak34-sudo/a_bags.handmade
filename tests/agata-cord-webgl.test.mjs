import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [stack, renderer, css] = await Promise.all([
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-agata-cord-webgl.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-agata-cord-webgl.css", import.meta.url), "utf8"),
]);

test("legacy Agata cord renderer is isolated from the authoritative V18 customer renderer", () => {
  assert.doesNotMatch(stack, /<BagBuilderAgataCordWebGL\s*\/>/);
  assert.doesNotMatch(stack, /<BagBuilderFinalWebGL3D\s*\/>/);
  assert.match(renderer, /agataOpenV|agataVerticalOpen|agataBasket|agataRadial/);
  assert.match(css, /data-abags-agata-cord-webgl/);
});

test("legacy cord renderer remains deterministic and Photo-True safe", () => {
  assert.doesNotMatch(renderer, /Math\.random/);
  assert.doesNotMatch(renderer, /setInterval/);
  assert.doesNotMatch(renderer, /readPixels/);
  assert.match(renderer, /requestAnimationFrame/);
});
