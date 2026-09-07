import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const evidence = fs.readFileSync("lib/craft-evidence.ts", "utf8");
const route = fs.readFileSync("app/api/admin/craft-calibration/route.ts", "utf8");
const coverage = fs.readFileSync("app/panel/craft-evidence-coverage.tsx", "utf8");
const panel = fs.readFileSync("app/panel/admin-panel.tsx", "utf8");

test("coverage spans every supported family and stitch instead of a hand-picked subset", () => {
  assert.match(evidence, /BUILDER_FAMILIES\.flatMap/);
  assert.match(evidence, /BUILDER_STITCHES\.map/);
  assert.match(evidence, /totalCells: cells\.length/);
});

test("BODY_VALIDATED requires a validated golden master, gauge and cord with matching references", () => {
  assert.match(evidence, /resolveValidatedBodyEvidenceChain/);
  assert.match(evidence, /master\.status !== "VALIDATED"/);
  assert.match(evidence, /gauge\.status !== "VALIDATED"/);
  assert.match(evidence, /gauge\.cordMaterialId !== master\.cordMaterialId/);
  assert.match(evidence, /gauge\.stitchPatternId !== master\.stitchPatternId/);
  assert.match(evidence, /cord\.status !== "VALIDATED"/);
  assert.match(evidence, /masters\.length \? "BODY_VALIDATED"/);
});

test("BODY_VALIDATED also requires complete positive production measurements", () => {
  assert.match(evidence, /positive\(master\.widthMm\)/);
  assert.match(evidence, /positive\(master\.actualCordUsedMm\)/);
  assert.match(evidence, /positive\(gauge\.stitchPitchXmm\)/);
  assert.match(evidence, /positive\(gauge\.rowPitchYmm\)/);
  assert.match(evidence, /positive\(gauge\.metersPerStitch\)/);
  assert.match(evidence, /positive\(cord\.measuredDiameterMm\)/);
  assert.match(evidence, /positive\(cord\.metersPerSpool\)/);
  assert.match(evidence, /positive\(cord\.gramsPerMeter\)/);
});

test("body evidence is explicitly narrower than full product validation", () => {
  assert.match(evidence, /level: "BODY_ONLY"/);
  assert.match(evidence, /Nie potwierdza jeszcze akcesoriów, mocowań ani pełnej konfiguracji sprzedażowej/);
  assert.doesNotMatch(evidence, /FULL_PRODUCT_VALIDATED/);
});

test("owner-only calibration API exposes the evidence dashboard", () => {
  assert.match(route, /getCraftEvidenceDashboard/);
  assert.match(route, /isAdminRequest\(request\)/);
});

test("owner panel shows the family-by-stitch evidence matrix with conservative labels", () => {
  assert.match(panel, /CraftEvidenceCoverage/);
  assert.match(coverage, /Pokrycie fizycznych wzorców korpusu/);
  assert.match(coverage, /BODY_VALIDATED ✓/);
  assert.match(coverage, /NOT_VALIDATED/);
  assert.match(coverage, /brak spójnego wzorca/);
  assert.match(coverage, /Zakres tego statusu/);
});
