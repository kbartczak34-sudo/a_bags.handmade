import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const parts = Array.from({ length: 6 }, (_, index) =>
  fs.readFileSync(`public/images/configurator/exact-live-v4/sprite-part-${String(index).padStart(2, "0")}.txt`, "utf8"),
);

test("exact live sprite parts reconstruct the expected photographic WebP", () => {
  assert.deepEqual(parts.map((part) => part.length), [5000, 5000, 5000, 5000, 5000, 4720]);
  const image = Buffer.from(parts.join(""), "base64");
  assert.equal(image.length, 22290);
  assert.equal(image.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(image.subarray(8, 12).toString("ascii"), "WEBP");
});
