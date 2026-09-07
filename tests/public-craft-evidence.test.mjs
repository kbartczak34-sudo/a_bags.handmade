import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const publicEvidence = fs.readFileSync("lib/public-craft-evidence.ts", "utf8");
const route = fs.readFileSync("app/api/configurator/evidence/route.ts", "utf8");

test("public catalog is built only from the strict validated body evidence chain and explicit color mapping", () => {
  assert.match(publicEvidence, /resolveValidatedBodyEvidenceChain\(master, snapshot\)/);
  assert.match(publicEvidence, /if \(!chain\) return \[\]/);
  assert.match(publicEvidence, /findCraftCordBuilderColor\(colorBindings, chain\.cord\.id\)/);
  assert.match(publicEvidence, /if \(!color \|\| \(filters\.color && color !== filters\.color\)\) return \[\]/);
  assert.match(publicEvidence, /status: "BODY_VALIDATED"/);
  assert.match(publicEvidence, /fullProductStatus: "NOT_VALIDATED"/);
  assert.match(publicEvidence, /sellable1to1: false/);
});

test("public evidence exposes only identifiers, mapped builder color and customer-safe physical summary", () => {
  assert.match(publicEvidence, /color,/);
  assert.match(publicEvidence, /cordMaterialId: chain\.cord\.id/);
  assert.match(publicEvidence, /gaugeProfileId: chain\.gauge\.id/);
  assert.match(publicEvidence, /goldenMasterId: chain\.master\.id/);
  assert.match(publicEvidence, /supplierSku: chain\.cord\.supplierSku/);
  assert.match(publicEvidence, /measuredDiameterMm: chain\.cord\.measuredDiameterMm/);
  assert.match(publicEvidence, /widthMm: chain\.master\.widthMm/);
  assert.match(publicEvidence, /heightMm: chain\.master\.heightMm/);
  assert.match(publicEvidence, /depthMm: chain\.master\.depthMm/);
});

test("public serializer never exposes workshop economics, notes or process telemetry", () => {
  for (const forbidden of [
    "purchasePriceCents",
    "notes",
    "createdAt",
    "updatedAt",
    "actualCordUsedMm",
    "actualMassG",
    "gramsPerMeter",
    "metersPerSpool",
    "tensionProfileId",
  ]) {
    assert.doesNotMatch(publicEvidence, new RegExp(forbidden));
  }
});

test("public evidence route is GET-only, validates family, stitch and color filters and returns no-store data", () => {
  assert.match(route, /export async function GET\(request: Request\)/);
  assert.doesNotMatch(route, /export async function POST|export async function PUT|export async function DELETE/);
  assert.match(route, /INVALID_FAMILY/);
  assert.match(route, /INVALID_STITCH/);
  assert.match(route, /INVALID_COLOR/);
  assert.match(route, /BUILDER_FAMILIES/);
  assert.match(route, /BUILDER_STITCHES/);
  assert.match(route, /BUILDER_COLORS/);
  assert.match(route, /url\.searchParams\.get\("color"\)/);
  assert.match(route, /Cache-Control/);
  assert.match(route, /no-store/);
});

test("public route reads calibration and color mapping together and fails closed when evidence is unavailable", () => {
  assert.match(route, /getCraftCalibrationSnapshot/);
  assert.match(route, /getCraftCordColorBindings/);
  assert.match(route, /Promise\.all/);
  assert.match(route, /buildPublicCraftBodyEvidenceCatalog\(snapshot, colorBindings/);
  assert.match(route, /EVIDENCE_UNAVAILABLE/);
  assert.match(route, /503/);
  assert.doesNotMatch(route, /isAdminRequest/);
});
