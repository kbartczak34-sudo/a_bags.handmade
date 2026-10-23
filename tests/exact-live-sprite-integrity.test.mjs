import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createHash } from "node:crypto";
const metadata = JSON.parse(fs.readFileSync("public/images/configurator/exact-live-v4/integrity.json", "utf8"));

const parts = Array.from({ length: 6 }, (_, index) =>
  fs.readFileSync(`public/images/configurator/exact-live-v4/sprite-part-${String(index).padStart(2, "0")}.txt`, "utf8"),
);

test("exact live sprite parts reconstruct the expected photographic WebP", () => {
  assert.deepEqual(parts.map((part) => part.length), metadata.partLengths);
  const image = Buffer.from(parts.join(""), "base64");
  assert.equal(image.length, metadata.decodedBytes);
  assert.equal(parts.join("").length, metadata.encodedLength);
  assert.equal(createHash("sha256").update(parts.join("")).digest("hex"), metadata.sha256Encoded);
  assert.equal(image.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(image.subarray(8, 12).toString("ascii"), "WEBP");
});
