import { BUILDER_FAMILIES, BUILDER_STITCHES, type BuilderFamily, type BuilderStitch } from "./bag-builder-settings";
import {
  getCraftCalibrationSnapshot,
  type CordMaterialRecord,
  type CraftCalibrationSnapshot,
  type GaugeProfileRecord,
  type GoldenMasterRecord,
} from "./craft-calibration";

export type CraftBodyEvidenceStatus = "NOT_VALIDATED" | "BODY_VALIDATED";

export type ValidatedCraftBodyEvidenceChain = {
  master: GoldenMasterRecord;
  gauge: GaugeProfileRecord;
  cord: CordMaterialRecord;
};

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

function positive(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function resolveValidatedBodyEvidenceChain(
  master: GoldenMasterRecord,
  snapshot: CraftCalibrationSnapshot,
): ValidatedCraftBodyEvidenceChain | null {
  if (master.status !== "VALIDATED") return null;
  if (!positive(master.widthMm) || !positive(master.heightMm) || !positive(master.depthMm)) return null;
  if (!positive(master.actualCordUsedMm) || !positive(master.actualMassG)) return null;

  const gauge = snapshot.gauges.find((item) => item.id === master.gaugeProfileId);
  if (!gauge || gauge.status !== "VALIDATED") return null;
  if (gauge.cordMaterialId !== master.cordMaterialId || gauge.stitchPatternId !== master.stitchPatternId) return null;
  if (!positive(gauge.hookSizeMm) || !positive(gauge.sampleStitches) || !positive(gauge.sampleRows)) return null;
  if (!positive(gauge.sampleWidthMm) || !positive(gauge.sampleHeightMm) || !positive(gauge.cordUsedMm)) return null;
  if (!positive(gauge.stitchPitchXmm) || !positive(gauge.rowPitchYmm) || !positive(gauge.metersPerStitch)) return null;

  const cord = snapshot.cords.find((item) => item.id === master.cordMaterialId);
  if (!cord || cord.status !== "VALIDATED") return null;
  if (!positive(cord.nominalDiameterMm) || !positive(cord.measuredDiameterMm)) return null;
  if (!positive(cord.metersPerSpool) || !positive(cord.gramsPerMeter)) return null;
  if (!cord.supplier.trim() || !cord.supplierSku.trim() || !cord.name.trim()) return null;

  return { master, gauge, cord };
}

export function buildCraftBodyCoverage(snapshot: CraftCalibrationSnapshot): CraftEvidenceCoverage {
  const cells = BUILDER_FAMILIES.flatMap((family) => BUILDER_STITCHES.map((stitch) => {
    const masters = snapshot.goldenMasters.filter((master) =>
      master.bagFamily === family
      && master.stitchPatternId === stitch
      && resolveValidatedBodyEvidenceChain(master, snapshot) !== null,
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
    && resolveValidatedBodyEvidenceChain(master, snapshot) !== null,
  );
}
