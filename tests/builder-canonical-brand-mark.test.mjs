import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const favicon = fs.readFileSync("public/favicon.svg", "utf8");
const ownerMark = fs.readFileSync("public/abags-owner-mark.svg", "utf8");
const guard = fs.readFileSync("app/bag-builder-reference-header-guard.tsx", "utf8");

function normalizedTextBlock(svg, label) {
  const blocks = svg.match(/<text[\s\S]*?<\/text>/g) ?? [];
  const block = blocks.find((candidate) => candidate.includes(`>${label}</text>`));
  assert.ok(block, `missing ${label} wordmark block`);
  return block.replace(/\s+/g, " ").trim();
}

test("canonical owner mark reuses the approved favicon wordmark without inventing new brand styling", () => {
  assert.equal(
    normalizedTextBlock(ownerMark, "a_bags"),
    normalizedTextBlock(favicon, "a_bags"),
  );
  assert.equal(
    normalizedTextBlock(ownerMark, "HANDMADE"),
    normalizedTextBlock(favicon, "HANDMADE"),
  );
  assert.doesNotMatch(ownerMark, /<rect\b/);
  assert.match(ownerMark, /viewBox="0 140 512 210"/);
});

test("final builder header owns branding through the canonical SVG instead of reconstructed text", () => {
  assert.match(guard, /const OWNER_MARK_SRC = "\/abags-owner-mark\.svg"/);
  assert.match(guard, /document\.createElement\("img"\)/);
  assert.match(guard, /mark\.src = OWNER_MARK_SRC/);
  assert.match(guard, /mark\.alt = OWNER_MARK_ALT/);
  assert.match(guard, /current\.replaceWith\(mark\)/);
  assert.match(guard, /wordmarkOwned = ownWordmark\(header\)/);
  assert.match(guard, /eyebrowOwned && titleOwned && wordmarkOwned/);
  assert.doesNotMatch(guard, /innerHTML[\s\S]*a_bags/);
});
