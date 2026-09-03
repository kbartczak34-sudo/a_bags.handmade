import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("reference experience is wired into the live customizer", async () => {
  const source = await read("app/exact-live-customizer.tsx");
  assert.match(source, /BagBuilderReferenceExperience/);
  assert.match(source, /<BagBuilderReferenceExperience\s*\/>/);
});

test("approved reference controls remain functional rather than static", async () => {
  const source = await read("app/bag-builder-reference-experience.tsx");
  assert.match(source, /Etapy projektowania torebki/);
  assert.match(source, /Aktywne warstwy/);
  assert.match(source, /Inspiracje dla Ciebie/);
  assert.match(source, /applyPreset/);
  assert.match(source, /data-builder-key/);
  assert.match(source, /scrollIntoView/);
  assert.match(source, /PODGLĄD NA ŻYWO · OBRÓT 360°/);
  assert.match(source, /data-ref-group-legend/);
  assert.match(source, /is-ref-expanded/);
});

test("reference cards reuse the real 1:1 A-Bags atelier sprite", async () => {
  const source = await read("app/bag-builder-reference-experience.tsx");
  const library = await read("lib/exact-customizer-library.ts");
  assert.match(source, /EXACT_ATELIER_LIBRARY/);
  assert.match(source, /EXACT_ATELIER_SPRITE_PARTS/);
  assert.match(source, /image\/webp/);
  assert.match(source, /abags-ref-photo/);
  assert.match(source, /abags-ref-family-photo/);
  assert.match(library, /navy-wood-scarf-chain/);
  assert.match(library, /black-leather-flap/);
});

test("reference layer does not replace mobile 3D interaction surface", async () => {
  const css = await read("app/bag-builder-reference-experience.css");
  const layout = await read("app/layout.tsx");
  assert.match(layout, /bag-builder-reference-experience\.css/);
  assert.match(css, /@media\(max-width:980px\)/);
  assert.match(css, /\.abags-ref-layers\{display:none!important\}/);
  assert.match(css, /abags-canvas3d-active/);
  assert.match(css, /abags-pro3d-active/);
  assert.match(css, /data-ref-collapsible/);
});
