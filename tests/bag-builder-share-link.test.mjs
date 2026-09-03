import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const share = fs.readFileSync("app/bag-builder-share-link.tsx", "utf8");
const exact = fs.readFileSync("app/exact-live-customizer.tsx", "utf8");

test("shareable project links are mounted with the active Bag Builder", () => {
  assert.match(exact, /BagBuilderShareLink/);
  assert.match(exact, /<BagBuilderShareLink \/>/);
});

test("shared project format is versioned and contains all builder decisions", () => {
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

test("incoming shared projects are validated before being applied", () => {
  assert.match(share, /function decodeProject/);
  assert.match(share, /parts\.length !== 9/);
  assert.match(share, /isValid\(config\) && isComplete\(config\)/);
  assert.match(share, /const ALLOWED/);
});

test("shared projects are restored through actual builder choices in dependency order", () => {
  assert.match(share, /const ORDER: BuilderKey\[] = \["family", "color", "stitch", "flap", "handles", "strap", "hardware", "accent"\]/);
  assert.match(share, /button\.click\(\)/);
  assert.match(share, /waitForStageValue/);
  assert.match(share, /for \(const key of ORDER\)/);
});

test("restored projects persist locally and imported URL state is cleaned up", () => {
  assert.match(share, /localStorage\.setItem\(DRAFT_KEY, JSON\.stringify\(config\)\)/);
  assert.match(share, /searchParams\.delete\(PARAM\)/);
  assert.match(share, /history\.replaceState/);
});

test("complete projects expose a copyable share link with clipboard fallback", () => {
  assert.match(share, /Udostępnij projekt/);
  assert.match(share, /Link skopiowany ✓/);
  assert.match(share, /navigator\.clipboard/);
  assert.match(share, /document\.execCommand\("copy"\)/);
  assert.match(share, /button\.disabled = !isComplete\(config\)/);
});
