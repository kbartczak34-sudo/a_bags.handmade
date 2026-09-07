import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const status = fs.readFileSync("app/bag-builder-physical-evidence-status.tsx", "utf8");
const exact = fs.readFileSync("app/exact-live-customizer.tsx", "utf8");

test("physical evidence status is mounted with the active Bag Builder", () => {
  assert.match(exact, /BagBuilderPhysicalEvidenceStatus/);
  assert.match(exact, /<BagBuilderPhysicalEvidenceStatus \/>/);
});

test("status reads the same shared client configuration as checkout and autosave", () => {
  assert.match(status, /useBagBuilderClientConfig/);
  assert.match(status, /family: config\.family/);
  assert.match(status, /stitch: config\.stitch/);
  assert.match(status, /color: config\.color/);
});

test("exact family, stitch and color are sent to the read-only evidence endpoint", () => {
  assert.match(status, /new URLSearchParams/);
  assert.match(status, /\/api\/configurator\/evidence\?/);
  assert.match(status, /cache: "no-store"/);
  assert.match(status, /new AbortController\(\)/);
  assert.match(status, /controller\.abort\(\)/);
});

test("customer status distinguishes no evidence, one binding and ambiguous multiple bindings", () => {
  assert.match(status, /Digital Craft Twin · NOT_VALIDATED/);
  assert.match(status, /Korpus · BODY_VALIDATED ✓/);
  assert.match(status, /options\.length > 1/);
  assert.match(status, /System nie wybiera żadnego automatycznie/);
  assert.match(status, /SKU \$\{option\.material\.supplierSku\}/);
  assert.match(status, /średnica zmierzona/);
});

test("BODY_VALIDATED copy remains explicitly narrower than full product validation", () => {
  assert.match(status, /wyłącznie korpus/);
  assert.match(status, /Pełna torebka nadal wymaga walidacji akcesoriów i mocowań/);
  assert.match(status, /akcesoria i mocowania nadal mają status NOT_VALIDATED/);
  assert.match(status, /Brak odczytu dowodu nie jest traktowany jako potwierdzenie 1:1/);
});

test("observational status cannot change choices, build V2 or touch checkout", () => {
  assert.doesNotMatch(status, /\.click\(\)/);
  assert.doesNotMatch(status, /physicalBinding|schemaVersion:\s*2|DIGITAL_CRAFT_TWIN/);
  assert.doesNotMatch(status, /checkout|stripe|blik|payment|unitAmount|grossCents/i);
  assert.doesNotMatch(status, /localStorage\.setItem/);
});

test("status card is accessible and cleaned up on unmount", () => {
  assert.match(status, /data-builder-physical-evidence/);
  assert.match(status, /role", "status"/);
  assert.match(status, /aria-live", "polite"/);
  assert.match(status, /querySelector\("\[data-builder-physical-evidence\]"\)\?\.remove\(\)/);
});
