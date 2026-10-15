import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [reference, css, stack, library] = await Promise.all([
  readFile(new URL("../app/bag-builder-reference-experience.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-real-reference.css", import.meta.url), "utf8"),
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../lib/exact-customizer-library.ts", import.meta.url), "utf8"),
]);

test("customer family choices show genuine atelier photographic cells instead of drawn thumbs", () => {
  assert.match(reference, /const photoThumb = button\.querySelector<HTMLElement>\("\.abags-builder-family-thumb"\)/);
  assert.match(reference, /applySpriteCell\(photoThumb, spriteUrl, referenceId\)/);
  assert.match(reference, /spritePosition\(realReference\.index\)/);
  assert.match(css, /\.abags-builder-family-thumb\[data-reference-id\] > span/);
  assert.match(css, /display:none!important/);
  assert.match(library, /EXACT_ATELIER_SPRITE_PARTS/);
});

test("photo is explicitly a reference not a false preview of chosen yarn/handles", () => {
  assert.match(reference, /Zdjęcie przykładowego fasonu, nie wizualizacja wybranych zmian/);
  assert.match(reference, /nie jest to podgląd Twoich zmian/);
  assert.match(reference, /ensureAtelierExample\(preview, stage, spriteUrl\)/);
  assert.match(reference, /Pokaż prawdziwą torebkę/);
  assert.match(reference, /Wróć do modelu 3D/);
  assert.match(reference, /viewer\.dataset\.exampleSignature !== signature/);
});

test("photo control does not replace or disable canonical interactive 3D renderer", () => {
  assert.match(stack, /<BagBuilderFidelity3D \/>/);
  assert.match(stack, /import "\.\/bag-builder-real-reference\.css"/);
  assert.match(css, /\.abags-vc-preview > \.abags-real-example-ui/);
  assert.match(css, /pointer-events:none!important/);
  assert.doesNotMatch(reference, /canvas\.getContext|canvas\.remove\(/);
});
