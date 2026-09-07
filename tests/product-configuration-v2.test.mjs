import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const v2 = fs.readFileSync("lib/product-configuration-v2.ts", "utf8");

test("ProductConfigurationV2 has an explicit Digital Craft Twin schema and physical binding", () => {
  assert.match(v2, /schemaVersion:\s*2/);
  assert.match(v2, /source:\s*"DIGITAL_CRAFT_TWIN"/);
  assert.match(v2, /cordMaterialId:\s*string/);
  assert.match(v2, /gaugeProfileId:\s*string/);
  assert.match(v2, /goldenMasterId:\s*string/);
  assert.match(v2, /PRODUCT_CONFIGURATION_V2_RESOLVER_VERSION\s*=\s*"craft-v2-body-1"/);
});

test("V2 never trusts client supplied physical measurements", () => {
  assert.match(v2, /snapshot\.cords\.find/);
  assert.match(v2, /snapshot\.gauges\.find/);
  assert.match(v2, /snapshot\.goldenMasters\.find/);
  assert.doesNotMatch(v2, /source\.measuredDiameterMm|source\.stitchPitchXmm|source\.actualCordUsedMm|source\.actualMassG/);
});

test("body validation rechecks status and every critical evidence-chain relation", () => {
  assert.match(v2, /CORD_PROFILE_NOT_VALIDATED/);
  assert.match(v2, /GAUGE_PROFILE_NOT_VALIDATED/);
  assert.match(v2, /GOLDEN_MASTER_NOT_VALIDATED/);
  assert.match(v2, /GAUGE_CORD_MISMATCH/);
  assert.match(v2, /GAUGE_STITCH_MISMATCH/);
  assert.match(v2, /GOLDEN_MASTER_FAMILY_MISMATCH/);
  assert.match(v2, /GOLDEN_MASTER_STITCH_MISMATCH/);
  assert.match(v2, /GOLDEN_MASTER_CORD_MISMATCH/);
  assert.match(v2, /GOLDEN_MASTER_GAUGE_MISMATCH/);
  assert.match(v2, /EVIDENCE_CHAIN_CORD_MISMATCH/);
  assert.match(v2, /EVIDENCE_CHAIN_STITCH_MISMATCH/);
});

test("validated physical response is built only from server-side calibration records", () => {
  assert.match(v2, /supplierSku:\s*cord\.supplierSku/);
  assert.match(v2, /measuredDiameterMm:\s*cord\.measuredDiameterMm/);
  assert.match(v2, /stitchPitchXmm:\s*gauge\.stitchPitchXmm/);
  assert.match(v2, /rowPitchYmm:\s*gauge\.rowPitchYmm/);
  assert.match(v2, /metersPerStitch:\s*gauge\.metersPerStitch/);
  assert.match(v2, /widthMm:\s*master\.widthMm/);
  assert.match(v2, /actualCordUsedMm:\s*master\.actualCordUsedMm/);
  assert.match(v2, /actualMassG:\s*master\.actualMassG/);
});

test("body validation cannot be mistaken for full 1:1 sellability", () => {
  assert.match(v2, /scope:\s*"BODY_ONLY"/);
  assert.match(v2, /fullProductStatus:\s*"NOT_VALIDATED"/);
  assert.match(v2, /sellable1to1:\s*false/);
  assert.match(v2, /status:\s*"CONSULTATION_ONLY"/);
  assert.match(v2, /reasonCode:\s*"FULL_PRODUCT_NOT_VALIDATED"/);
  assert.match(v2, /ACCESSORY_PROFILES_NOT_BOUND/);
  assert.match(v2, /MOUNTING_PROFILES_NOT_BOUND/);
});

test("V2 retains server-side compatibility, price and canonical configuration identity", () => {
  assert.match(v2, /isBagBuilderProjectCompatible/);
  assert.match(v2, /resolveConfiguratorPricing/);
  assert.match(v2, /createConfigurationHash\(configuration\)/);
  assert.match(v2, /bagBuilderProjectCode\(configuration\.selection\)/);
  assert.doesNotMatch(v2, /grossCents\s*:\s*source|priceCents\s*:\s*source/);
});
