import { BUILDER_FAMILIES, BUILDER_STITCHES, type BuilderFamily, type BuilderStitch } from "./bag-builder-settings";
import { getCraftCalibrationSnapshot, type CraftCalibrationSnapshot, type GoldenMasterRecord } from "./craft-calibration";

export type CraftBodyEvidenceStatus = "NOT_VALIDATED" | "BODY_VALIDATED";

export type CraftBodyCoverageCell = {
  family: BuilderFamily;
  stitch: BuilderStitch;
  status: CraftBodyEvidenceStatus;
  evidenceCount: number;
  goldenMasterIds: string[];
};

export type CraftEvidenceCoverage = {
  level: "BODY_ONLY";
  validatedCells: number;
  totalCells: number;
  cells: CraftBodyCoverageCell[];
  note: string;
};

function masterHasValidatedChain(master: GoldenMasterRecord, snapshot: CraftCalibrationSnapshot) {
  if (master.status !== "VALIDATED") return false;
  const gauge = snapshot.gauges.find((item) => item.id === master.gaugeProfileId);
  if (!gauge || gauge.status !== "VALIDATED") return false;
  if (gauge.cordMaterialId !== master.cordMaterialId || gauge.stitchPatternId !== master.stitchPatternId) return false;
  const cord = snapshot.cords.find((item) => item.id === master.cordMaterialId);
  return Boolean(cord && cord.status === "VALIDATED");
}

export function buildCraftBodyCoverage(snapshot: CraftCalibrationSnapshot): CraftEvidenceCoverage {
  const cells = BUILDER_FAMILIES.flatMap((family) => BUILDER_STITCHES.map((stitch) => {
    const masters = snapshot.goldenMasters.filter((master) =>
      master.bagFamily === family
      && master.stitchPatternId === stitch
      && masterHasValidatedChain(master, snapshot),
    );
    return {
      family,
      stitch,
      status: masters.length ? "BODY_VALIDATED" as const : "NOT_VALIDATED" as const,
      evidenceCount: masters.length,
      goldenMasterIds: masters.map((master) => master.id),
    };
  }));

  return {
    level: "BODY_ONLY",
    validatedCells: cells.filter((cell) => cell.status === "BODY_VALIDATED").length,
    totalCells: cells.length,
    cells,
    note: "BODY_VALIDATED potwierdza wyłącznie zwalidowany łańcuch materiał → Gauge → Golden Master korpusu. Nie potwierdza jeszcze akcesoriów, mocowań ani pełnej konfiguracji sprzedażowej.",
  };
}

export async function getCraftEvidenceDashboard() {
  const calibration = await getCraftCalibrationSnapshot();
  return {
    ...calibration,
    coverage: buildCraftBodyCoverage(calibration),
  };
}

export function findValidatedBodyEvidence(
  snapshot: CraftCalibrationSnapshot,
  family: BuilderFamily,
  stitch: BuilderStitch,
) {
  return snapshot.goldenMasters.filter((master) =>
    master.bagFamily === family
    && master.stitchPatternId === stitch
    && masterHasValidatedChain(master, snapshot),
  );
}
