import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const store = fs.readFileSync("app/bag-builder-config-store.ts", "utf8");
const commerce = fs.readFileSync("app/bag-builder-commerce.tsx", "utf8");
const checkout = fs.readFileSync("app/bag-builder-checkout-handoff.tsx", "utf8");
const autosave = fs.readFileSync("app/bag-builder-autosave.tsx", "utf8");
const share = fs.readFileSync("app/bag-builder-share-link.tsx", "utf8");
const guard = fs.readFileSync("app/bag-builder-validation-guard.tsx", "utf8");

test("client configuration has one normalized external-store boundary", () => {
  assert.match(store, /useSyncExternalStore/);
  assert.match(store, /const STAGE_SELECTOR = "\.abags-bag-builder-stage"/);
  assert.match(store, /const OBSERVED_ATTRIBUTES/);
  assert.match(store, /new MutationObserver\(synchronize\)/);
  assert.match(store, /attributeFilter: \[\.\.\.OBSERVED_ATTRIBUTES\]/);
  assert.match(store, /normalizeBagBuilderDraftInput/);
  assert.match(store, /normalizedBaseProductId/);
});

test("shared store owns the complete supported legacy value vocabulary", () => {
  assert.match(store, /const FAMILIES/);
  assert.match(store, /"tote", "round", "bucket", "mini"/);
  assert.match(store, /const COLORS/);
  assert.match(store, /#E8DDCC/);
  assert.match(store, /#A88AE0/);
  assert.match(store, /const STITCHES/);
  assert.match(store, /"classic", "herringbone", "basket", "shell"/);
  assert.match(store, /const FLAPS/);
  assert.match(store, /const HANDLES/);
  assert.match(store, /const STRAPS/);
  assert.match(store, /const HARDWARE/);
  assert.match(store, /const ACCENTS/);
});

test("shared store preserves raw integrity failures instead of hiding them through normalization", () => {
  assert.match(store, /invalidKeys: BagBuilderConfigKey\[\]/);
  assert.match(store, /if \(!ALLOWED\[key\]\.has/);
  assert.match(store, /invalidKeys\.push\(key\)/);
  assert.match(store, /photoTrueActive: stage\.dataset\.abagsPhotoTrue === "active"/);
  assert.match(store, /data-abags-photo-true/);
});

test("draft conversion deliberately excludes photographed base identity from legacy localStorage payload", () => {
  assert.match(store, /type BagBuilderDraftConfig = Omit<BagBuilderClientConfig, "baseProductId">/);
  assert.match(store, /toBagBuilderDraftConfig/);
  assert.match(store, /const \{ baseProductId: _baseProductId, \.\.\.draft \} = config/);
});

test("commerce, checkout, autosave, share links and validation consume the shared store", () => {
  for (const source of [commerce, checkout, autosave]) {
    assert.match(source, /useBagBuilderClientConfig/);
  }
  for (const source of [share, guard]) {
    assert.match(source, /useBagBuilderClientState/);
  }
});

test("migrated consumers no longer maintain independent configuration attribute observers", () => {
  for (const source of [commerce, checkout, autosave, share, guard]) {
    assert.doesNotMatch(source, /attributeFilter:\s*\["data-family"/);
  }
  assert.doesNotMatch(commerce, /function readConfig/);
  assert.doesNotMatch(checkout, /function readConfig/);
  assert.doesNotMatch(autosave, /function readConfig/);
  assert.doesNotMatch(share, /const ALLOWED/);
  assert.doesNotMatch(guard, /const ALLOWED/);
  assert.doesNotMatch(checkout, /stage\.dataset\.photoProductId/);
});

test("store observer is shared and released when the last consumer unsubscribes", () => {
  assert.match(store, /const listeners = new Set/);
  assert.match(store, /listeners\.add\(listener\)/);
  assert.match(store, /listeners\.delete\(listener\)/);
  assert.match(store, /if \(listeners\.size > 0\) return/);
  assert.match(store, /observer\?\.disconnect\(\)/);
});
