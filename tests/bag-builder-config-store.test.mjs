import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const store = fs.readFileSync("app/bag-builder-config-store.ts", "utf8");
const commerce = fs.readFileSync("app/bag-builder-commerce.tsx", "utf8");
const checkout = fs.readFileSync("app/bag-builder-checkout-handoff.tsx", "utf8");
const autosave = fs.readFileSync("app/bag-builder-autosave.tsx", "utf8");

test("client configuration has one normalized external-store boundary", () => {
  assert.match(store, /useSyncExternalStore/);
  assert.match(store, /const STAGE_SELECTOR = "\.abags-bag-builder-stage"/);
  assert.match(store, /const OBSERVED_ATTRIBUTES/);
  assert.match(store, /new MutationObserver\(synchronize\)/);
  assert.match(store, /attributeFilter: \[\.\.\.OBSERVED_ATTRIBUTES\]/);
  assert.match(store, /function normalizedColor/);
  assert.match(store, /function normalizedBaseProductId/);
});

test("shared store owns the supported legacy value vocabulary during compatibility migration", () => {
  assert.match(store, /const FAMILIES/);
  assert.match(store, /"tote", "round", "bucket", "mini"/);
  assert.match(store, /const STITCHES/);
  assert.match(store, /"classic", "herringbone", "basket", "shell"/);
  assert.match(store, /const FLAPS/);
  assert.match(store, /const HANDLES/);
  assert.match(store, /const STRAPS/);
  assert.match(store, /const HARDWARE/);
  assert.match(store, /const ACCENTS/);
});

test("draft conversion deliberately excludes photographed base identity from legacy localStorage payload", () => {
  assert.match(store, /type BagBuilderDraftConfig = Omit<BagBuilderClientConfig, "baseProductId">/);
  assert.match(store, /toBagBuilderDraftConfig/);
  assert.match(store, /const \{ baseProductId: _baseProductId, \.\.\.draft \} = config/);
});

test("commerce, checkout and autosave consume the same shared configuration hook", () => {
  for (const source of [commerce, checkout, autosave]) {
    assert.match(source, /useBagBuilderClientConfig/);
  }
});

test("migrated consumers no longer maintain independent stage configuration readers", () => {
  for (const source of [commerce, checkout, autosave]) {
    assert.doesNotMatch(source, /function readConfig/);
    assert.doesNotMatch(source, /attributeFilter:\s*\["data-family"/);
  }
  assert.doesNotMatch(checkout, /stage\.dataset\.photoProductId/);
  assert.doesNotMatch(autosave, /const ALLOWED/);
});

test("store observer is shared and released when the last consumer unsubscribes", () => {
  assert.match(store, /const listeners = new Set/);
  assert.match(store, /listeners\.add\(listener\)/);
  assert.match(store, /listeners\.delete\(listener\)/);
  assert.match(store, /if \(listeners\.size > 0\) return/);
  assert.match(store, /observer\?\.disconnect\(\)/);
});
