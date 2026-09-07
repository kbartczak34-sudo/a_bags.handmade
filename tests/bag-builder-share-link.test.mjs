import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const share = fs.readFileSync("app/bag-builder-share-link.tsx", "utf8");
const store = fs.readFileSync("app/bag-builder-config-store.ts", "utf8");
const exact = fs.readFileSync("app/exact-live-customizer.tsx", "utf8");

test("shareable project links are mounted with the active Bag Builder", () => {
  assert.match(exact, /BagBuilderShareLink/);
  assert.match(exact, /<BagBuilderShareLink \/>/);
});

test("legacy shared project format remains versioned and contains all builder decisions", () => {
  assert.match(share, /"v1"/);
  assert.match(share, /config\.family/);
  assert.match(share, /config\.color\.replace/);
  assert.match(share, /config\.stitch/);
  assert.match(share, /config\.flap/);
  assert.match(share, /config\.handles/);
  assert.match(share, /config\.strap/);
  assert.match(share, /config\.hardware/);
  assert.match(share, /config\.accent/);
});

test("Photo-True share URLs use the real product identity from the shared store", () => {
  assert.match(share, /const MODEL_PARAM = "model"/);
  assert.match(share, /useBagBuilderClientState/);
  assert.match(share, /config\.baseProductId/);
  assert.match(share, /photoTrueActive/);
  assert.match(share, /url\.searchParams\.set\(MODEL_PARAM, baseProductId\)/);
  assert.match(share, /validBagBuilderBaseProductId/);
});

test("incoming shared projects reuse the central value vocabulary before being applied", () => {
  assert.match(share, /function decodeProject/);
  assert.match(share, /parts\.length !== 9/);
  assert.match(share, /normalizeBagBuilderDraftInput/);
  assert.match(share, /invalidKeys\.length === 0/);
  assert.match(share, /isBagBuilderDraftConfigComplete\(config\)/);
  assert.doesNotMatch(share, /const ALLOWED/);
  assert.match(store, /const ALLOWED/);
});

test("Photo-True links restore the real product before applying personalization", () => {
  assert.match(share, /function applyPhotoProduct/);
  assert.match(share, /data-photo-product-choice/);
  assert.match(share, /candidate\.dataset\.photoProductChoice === modelId/);
  assert.match(share, /stage\.dataset\.photoProductId === modelId/);
  assert.match(share, /if \(modelId\)[\s\S]*?applyPhotoProduct\(stage, modelId\)/);
  assert.match(share, /BAG_BUILDER_CONFIG_ORDER\.filter\(\(key\) => key !== "family"\)/);
});

test("legacy links without a Photo-True model still restore builder choices in dependency order", () => {
  assert.match(store, /BAG_BUILDER_CONFIG_ORDER: BagBuilderConfigKey\[\] = \[[\s\S]*"family"[\s\S]*"color"[\s\S]*"stitch"[\s\S]*"flap"[\s\S]*"handles"[\s\S]*"strap"[\s\S]*"hardware"[\s\S]*"accent"/);
  assert.match(share, /button\.click\(\)/);
  assert.match(share, /waitForStageValue/);
  assert.match(share, /for \(const key of keys\)/);
});

test("restored projects persist configuration and Photo-True model and clean URL state", () => {
  assert.match(share, /localStorage\.setItem\(DRAFT_KEY, JSON\.stringify\(config\)\)/);
  assert.match(share, /localStorage\.setItem\(PHOTO_MODEL_KEY, modelId\)/);
  assert.match(share, /url\.searchParams\.delete\(param\)/);
  assert.match(share, /\[PARAM, MODEL_PARAM\]/);
  assert.match(share, /history\.replaceState/);
});

test("only complete and integrity-clean projects expose a copyable share link", () => {
  assert.match(share, /Udostępnij projekt/);
  assert.match(share, /Link skopiowany ✓/);
  assert.match(share, /navigator\.clipboard/);
  assert.match(share, /document\.execCommand\("copy"\)/);
  assert.match(share, /invalidKeys\.length > 0 \|\| !isBagBuilderDraftConfigComplete\(draft\) \|\| !photoReady/);
});
