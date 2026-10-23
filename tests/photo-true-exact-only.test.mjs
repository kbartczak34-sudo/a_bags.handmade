import assert from "node:assert/strict";
import fs from "node:fs";

const gate = fs.readFileSync("app/bag-builder-photo-true-gate.tsx", "utf8");
const guard = fs.readFileSync("app/bag-builder-photo-true-exact-only.tsx", "utf8");
const customizer = fs.readFileSync("app/exact-live-customizer.tsx", "utf8");
const library = fs.readFileSync("lib/exact-customizer-library.ts", "utf8");

// Photo-True remains an internal reference/QA surface; the customer builder
// continues to default to the realtime construction renderer.
assert.match(gate, /photoTrueQa/);
assert.match(gate, /abags-photo-true-v5/);
assert.match(gate, /abags-photo-mobile/);
assert.match(gate, /if \(!enabled\) return null/);
assert.match(guard, /EXACT_ATELIER_LIBRARY/);
assert.match(guard, /fileNameFromUrl\(baseImage\)/);
assert.match(guard, /reference\?\.id/);
assert.match(guard, /baseline = readConfig/);
assert.match(guard, /stage\.removeAttribute\("data-abags-photo-true"\)/);
assert.match(guard, /data-abags-photo-true-reference/i);
assert.match(guard, /custom-realtime/);
assert.match(guard, /catalogPhoto = validImage/);
assert.match(guard, /url\.searchParams\.get\("id"\) === selectedProduct/);
assert.match(guard, /"catalog-photograph"/);
assert.match(guard, /source === "exact-live-v4" \? "exact"/);
assert.match(customizer, /BagBuilderPhotoTrueExactOnly/);
assert.match(customizer, /<BagBuilderPhotoTrueExactOnly \/>/);
assert.match(library, /EXACT_ATELIER_LIBRARY/);
assert.equal((library.match(/\{ id:/g) || []).length, 20);

console.log("photo-true-exact-only: PASS");
