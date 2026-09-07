import assert from "node:assert/strict";
import fs from "node:fs";

const gate = fs.readFileSync("app/bag-builder-photo-true-gate.tsx", "utf8");
const guard = fs.readFileSync("app/bag-builder-photo-true-exact-only.tsx", "utf8");
const customizer = fs.readFileSync("app/exact-live-customizer.tsx", "utf8");
const library = fs.readFileSync("lib/exact-customizer-library.ts", "utf8");

assert.match(gate, /return <>{children}<\/\>;?/);
assert.doesNotMatch(gate, /photoTrueQa|abags-photo-true-v5|abags-photo-mobile/);
assert.match(guard, /EXACT_ATELIER_LIBRARY/);
assert.match(guard, /isKnownReference/);
assert.match(guard, /baseline = readConfig/);
assert.match(guard, /stage\.removeAttribute\("data-abags-photo-true"\)/);
assert.match(guard, /data-abags-photo-true-reference/i);
assert.match(guard, /custom-realtime/);
assert.match(customizer, /BagBuilderPhotoTrueExactOnly/);
assert.match(customizer, /<BagBuilderPhotoTrueExactOnly \/>/);
assert.match(library, /EXACT_ATELIER_LIBRARY/);
assert.equal((library.match(/\{ id:/g) || []).length, 19);

console.log("photo-true-exact-only: PASS");
