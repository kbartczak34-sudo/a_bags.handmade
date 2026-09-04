import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const guard = fs.readFileSync("app/bag-builder-photo-true-flow-guard.tsx", "utf8");
const mount = fs.readFileSync("app/exact-live-customizer.tsx", "utf8");

test("Photo-True flow guard is mounted immediately after the real-photo renderer", () => {
  assert.match(mount, /<BagBuilderPhotoTrue \/>\s*<BagBuilderPhotoTrueFlowGuard \/>/);
});

test("real model grid is moved ahead of the legacy family bridge", () => {
  assert.match(guard, /family\.insertBefore\(mount, options\)/);
  assert.match(guard, /mount\.nextElementSibling !== options/);
  assert.match(guard, /family\.dataset\.photoTrueFlow = "locked"/);
});

test("legacy family options cannot reserve visual space even against older important CSS", () => {
  assert.match(guard, /options\.hidden = true/);
  assert.match(guard, /setProperty\("display", "none", "important"\)/);
  assert.match(guard, /setProperty\("height", "0", "important"\)/);
  assert.match(guard, /setProperty\("min-height", "0", "important"\)/);
  assert.match(guard, /setProperty\("max-height", "0", "important"\)/);
  assert.match(guard, /setProperty\("padding", "0", "important"\)/);
  assert.match(guard, /setProperty\("overflow", "hidden", "important"\)/);
});

test("flow guard keeps legacy bridge reversible instead of deleting React controls", () => {
  assert.match(guard, /restoreLegacyOptions/);
  assert.match(guard, /options\.hidden = false/);
  assert.match(guard, /options\.style\.removeProperty/);
  assert.doesNotMatch(guard, /\.remove\(\)/);
});
