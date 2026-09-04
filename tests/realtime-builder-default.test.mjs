import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [stack, gate, engine, productionQa, workflow] = await Promise.all([
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-photo-true-gate.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-engine.tsx", import.meta.url), "utf8"),
  readFile(new URL("../scripts/smoke-customizer-realtime.mjs", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/deploy-cloudflare.yml", import.meta.url), "utf8"),
]);

test("customer customizer defaults to the realtime construction builder, not finished product photography", () => {
  assert.match(stack, /<BagBuilderEngine\s*\/>/);
  assert.match(stack, /<BagBuilderPhotoTrueGate>[\s\S]*<BagBuilderPhotoTrue\s*\/>[\s\S]*<BagBuilderPhotoTrueFlowGuard\s*\/>[\s\S]*<BagBuilderPhotoTrueOptionTruth\s*\/>[\s\S]*<\/BagBuilderPhotoTrueGate>/);
  assert.match(gate, /photoTrueQa/);
  assert.match(gate, /abags-photo-true-v5/);
  assert.doesNotMatch(gate, /navigator\.webdriver/);
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

test("production acceptance exercises the customer realtime builder instead of only Photo-True reference mode", () => {
  assert.match(productionQa, /localStorage\.removeItem\('abags-bag-builder-v3'\)/);
  assert.match(productionQa, /readyProductChoices/);
  assert.match(productionQa, /photoTrue/);
  assert.match(productionQa, /choose\("family"/);
  assert.match(productionQa, /choose\("color"/);
  assert.match(productionQa, /choose\("stitch"/);
  assert.match(productionQa, /signature === afterFamily\.signature/);
  assert.match(workflow, /Browser test customer realtime builder from empty construction/);
  assert.match(workflow, /Fail when customer realtime builder acceptance fails/);
});
