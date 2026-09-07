import type { BuilderFamily, BuilderStitch } from "./bag-builder-settings";
import type { CraftCalibrationSnapshot } from "./craft-calibration";
import { resolveValidatedBodyEvidenceChain } from "./craft-evidence";

export type PublicCraftBodyEvidenceOption = {
  family: BuilderFamily;
  stitch: BuilderStitch;
  status: "BODY_VALIDATED";
  binding: {
    cordMaterialId: string;
    gaugeProfileId: string;
    goldenMasterId: string;
  };
  material: {
    supplier: string;
    supplierSku: string;
    name: string;
    nominalDiameterMm: number;
    measuredDiameterMm: number;
  };
  body: {
    baseProductId: string | null;
    widthMm: number;
    heightMm: number;
    depthMm: number;
  };
};

export type PublicCraftBodyEvidenceCatalog = {
  schemaVersion: 1;
  level: "BODY_ONLY";
  fullProductStatus: "NOT_VALIDATED";
  sellable1to1: false;
  options: PublicCraftBodyEvidenceOption[];
};

export type PublicCraftEvidenceFilters = {
  family?: BuilderFamily;
  stitch?: BuilderStitch;
};

export function buildPublicCraftBodyEvidenceCatalog(
  snapshot: CraftCalibrationSnapshot,
  filters: PublicCraftEvidenceFilters = {},
): PublicCraftBodyEvidenceCatalog {
  const options = snapshot.goldenMasters.flatMap((master) => {
    if (filters.family && master.bagFamily !== filters.family) return [];
    if (filters.stitch && master.stitchPatternId !== filters.stitch) return [];

    const chain = resolveValidatedBodyEvidenceChain(master, snapshot);
    if (!chain) return [];

    return [{
      family: master.bagFamily,
      stitch: master.stitchPatternId,
      status: "BODY_VALIDATED" as const,
      binding: {
        cordMaterialId: chain.cord.id,
        gaugeProfileId: chain.gauge.id,
        goldenMasterId: chain.master.id,
      },
      material: {
        supplier: chain.cord.supplier,
        supplierSku: chain.cord.supplierSku,
        name: chain.cord.name,
        nominalDiameterMm: chain.cord.nominalDiameterMm,
        measuredDiameterMm: chain.cord.measuredDiameterMm!,
      },
      body: {
        baseProductId: chain.master.productId,
        widthMm: chain.master.widthMm,
        heightMm: chain.master.heightMm,
        depthMm: chain.master.depthMm,
      },
    }];
  });

  options.sort((left, right) =>
    left.family.localeCompare(right.family)
    || left.stitch.localeCompare(right.stitch)
    || left.material.supplierSku.localeCompare(right.material.supplierSku)
    || left.binding.goldenMasterId.localeCompare(right.binding.goldenMasterId),
  );

  return {
    schemaVersion: 1,
    level: "BODY_ONLY",
    fullProductStatus: "NOT_VALIDATED",
    sellable1to1: false,
    options,
  };
}
