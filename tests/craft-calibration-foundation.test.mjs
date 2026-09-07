import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const calibration = fs.readFileSync("lib/craft-calibration.ts", "utf8");
const route = fs.readFileSync("app/api/admin/craft-calibration/route.ts", "utf8");
const manager = fs.readFileSync("app/panel/craft-calibration-manager.tsx", "utf8");
const panel = fs.readFileSync("app/panel/admin-panel.tsx", "utf8");
const resolver = fs.readFileSync("lib/configurator-resolver.ts", "utf8");

test("craft calibration creates dedicated D1 evidence tables without startup seed measurements", () => {
  assert.match(calibration, /CREATE TABLE IF NOT EXISTS craft_cord_materials/);
  assert.match(calibration, /CREATE TABLE IF NOT EXISTS craft_gauge_profiles/);
  assert.match(calibration, /CREATE TABLE IF NOT EXISTS craft_golden_masters/);
  assert.match(calibration, /measured_diameter_mm REAL/);
  assert.match(calibration, /finished_thickness_mm REAL/);
  assert.doesNotMatch(calibration, /seedCord|seedGauge|seedGolden|DEFAULT_GAUGE|DEFAULT_GOLDEN_MASTER/);
  const ensureBody = calibration.match(/export async function ensureCraftCalibrationReady\(\)[\s\S]*?\n}\n\nexport async function getCraftCalibrationSnapshot/)?.[0] ?? "";
  assert.doesNotMatch(ensureBody, /INSERT INTO/);
});

test("physical evidence follows cord -> gauge -> golden master approval order", () => {
  assert.match(calibration, /Materiał można zatwierdzić dopiero po wpisaniu rzeczywistych pomiarów/);
  assert.match(calibration, /Gauge można zatwierdzić dopiero dla zatwierdzonego materiału sznurka/);
  assert.match(calibration, /Golden Master można zatwierdzić dopiero z zatwierdzonym profilem Gauge/);
  assert.match(calibration, /gauge\.cord_material_id !== cordMaterialId/);
  assert.match(calibration, /gauge\.stitch_pattern_id !== stitchPatternId/);
});

test("gauge derives pitch and consumption only from entered physical sample measurements", () => {
  assert.match(calibration, /stitchPitchXmm = sampleWidthMm \/ sampleStitches/);
  assert.match(calibration, /rowPitchYmm = sampleHeightMm \/ sampleRows/);
  assert.match(calibration, /metersPerStitch = cordUsedMm \/ 1000 \/ \(sampleStitches \* sampleRows\)/);
  assert.doesNotMatch(calibration, /stitchPitchXmm\s*=\s*[1-9]\d*(?:\.\d+)?;/);
  assert.doesNotMatch(calibration, /rowPitchYmm\s*=\s*[1-9]\d*(?:\.\d+)?;/);
});

test("craft calibration API is owner-only and accepts only explicit evidence record kinds", () => {
  assert.match(route, /isAdminRequest\(request\)/);
  assert.match(route, /Brak dostępu do laboratorium rzemiosła/);
  assert.match(route, /raw\.kind === "cord"/);
  assert.match(route, /raw\.kind === "gauge"/);
  assert.match(route, /raw\.kind === "golden-master"/);
  assert.match(route, /Nieobsługiwany typ kalibracji/);
});

test("owner panel exposes a craft laboratory instead of hiding physical calibration in code", () => {
  assert.match(panel, /CraftCalibrationManager/);
  assert.match(panel, /Laboratorium rzemiosła/);
  assert.match(manager, /Digital Craft Twin · kalibracja fizyczna/);
  assert.match(manager, /Agata zatwierdziła komplet pomiarów materiału/);
  assert.match(manager, /Agata zatwierdziła tę próbkę Gauge/);
  assert.match(manager, /Agata zatwierdziła Golden Master jako wzorzec 1:1/);
  assert.match(manager, /system nie uzupełnia brakujących wartości/i);
});

test("legacy resolver reports missing physical evidence without changing the current checkout validity gate", () => {
  assert.match(resolver, /physicalValidation: ConfiguratorPhysicalValidationResult/);
  assert.match(resolver, /status: "NOT_VALIDATED"/);
  assert.match(resolver, /observationalOnly: true/);
  assert.match(resolver, /CORD_PROFILE_NOT_BOUND/);
  assert.match(resolver, /GAUGE_PROFILE_NOT_BOUND/);
  assert.match(resolver, /GOLDEN_MASTER_NOT_BOUND/);
  assert.match(resolver, /status: validation\.valid \? "VALID" : "BLOCKED"/);
  assert.match(resolver, /pricing: resolvePricing/);
  assert.doesNotMatch(resolver, /status:\s*resolveLegacyPhysicalValidation/);
});

test("empty calibration is explicitly NOT_VALIDATED", () => {
  assert.match(calibration, /if \(!cordsValidated\) reasons\.push/);
  assert.match(calibration, /if \(!gaugesValidated\) reasons\.push/);
  assert.match(calibration, /if \(!goldenMastersValidated\) reasons\.push/);
  assert.match(calibration, /status: reasons\.length \? "NOT_VALIDATED" : "VALIDATED"/);
});
