import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [stack, gate, engine] = await Promise.all([
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-photo-true-gate.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-engine.tsx", import.meta.url), "utf8"),
]);

test("customer customizer defaults to the realtime construction builder, not finished product photography", () => {
  assert.match(stack, /<BagBuilderEngine\s*\/>/);
  assert.match(stack, /<BagBuilderPhotoTrueGate>[\s\S]*<BagBuilderPhotoTrue\s*\/>[\s\S]*<BagBuilderPhotoTrueFlowGuard\s*\/>[\s\S]*<BagBuilderPhotoTrueOptionTruth\s*\/>[\s\S]*<\/BagBuilderPhotoTrueGate>/);
  assert.match(gate, /photoTrueQa/);
  assert.match(gate, /navigator\.webdriver/);
  assert.match(gate, /if \(!enabled\) return null/);
});

test("new bag builder starts from an empty construction and builds decisions live", () => {
  assert.match(engine, /const EMPTY:[\s\S]*family:\s*""[\s\S]*color:\s*""[\s\S]*stitch:\s*""/);
  assert.match(engine, /data-builder-signature=\{signature\}/);
  assert.match(engine, /data-family=\{config\.family\}/);
  assert.match(engine, /data-color=\{config\.color\}/);
  assert.match(engine, /data-stitch=\{config\.stitch\}/);
  assert.match(engine, /onClick=\{\(\) => onChange\(option\.value\)\}/);
  assert.match(engine, /Pusty podgląd konfiguratora/);
});
