import type { BuilderColor, BuilderFamily, BuilderStitch } from "./bag-builder-settings";
import type { CraftCalibrationSnapshot } from "./craft-calibration";
import {
  findCraftCordBuilderColor,
  type CraftCordBuilderColorBinding,
} from "./craft-color-bindings";
import { resolveValidatedBodyEvidenceChain } from "./craft-evidence";

export type PublicCraftBodyEvidenceOption = {
  family: BuilderFamily;
  stitch: BuilderStitch;
  color: BuilderColor;
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
  color?: BuilderColor;
};

export function buildPublicCraftBodyEvidenceCatalog(
  snapshot: CraftCalibrationSnapshot,
  colorBindings: readonly CraftCordBuilderColorBinding[],
  filters: PublicCraftEvidenceFilters = {},
): PublicCraftBodyEvidenceCatalog {
  const options = snapshot.goldenMasters.flatMap((master) => {
    if (filters.family && master.bagFamily !== filters.family) return [];
    if (filters.stitch && master.stitchPatternId !== filters.stitch) return [];

    const chain = resolveValidatedBodyEvidenceChain(master, snapshot);
    if (!chain) return [];

    const color = findCraftCordBuilderColor(colorBindings, chain.cord.id);
    if (!color || (filters.color && color !== filters.color)) return [];

    return [{
      family: master.bagFamily,
      stitch: master.stitchPatternId,
      color,
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
    || left.color.localeCompare(right.color)
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
