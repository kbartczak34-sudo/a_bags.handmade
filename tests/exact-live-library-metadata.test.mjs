import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const metadata = JSON.parse(fs.readFileSync("public/images/configurator/exact-live-v4/integrity.json", "utf8"));
const library = fs.readFileSync("lib/exact-customizer-library.ts", "utf8");

test("exact photographic library metadata matches the selector map", () => {
  assert.equal(metadata.variantCount, 19);
  assert.equal(metadata.columns, 5);
  assert.equal(metadata.rows, 4);
  assert.equal(metadata.encodedLength, 29720);
  assert.equal((library.match(/index:\d+/g) || []).length, metadata.variantCount);
});
