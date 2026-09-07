import {
  bagBuilderProjectCode,
  isBagBuilderProjectCompatible,
  normalizeBagBuilderProjectConfig,
  type BagBuilderProjectConfig,
  type BagBuilderSettings,
} from "./bag-builder-settings";
import type {
  CordMaterialRecord,
  CraftCalibrationSnapshot,
  GaugeProfileRecord,
  GoldenMasterRecord,
} from "./craft-calibration";
import {
  ConfiguratorInputError,
  createConfigurationHash,
  resolveConfiguratorPricing,
  type ConfiguratorPricingResult,
  type ConfiguratorValidationIssue,
  type ConfiguratorValidationResult,
} from "./configurator-resolver";

export const PRODUCT_CONFIGURATION_V2_RESOLVER_VERSION = "craft-v2-body-1" as const;

export type ProductConfigurationV2 = {
  schemaVersion: 2;
  source: "DIGITAL_CRAFT_TWIN";
  selection: BagBuilderProjectConfig;
  physicalBinding: {
    cordMaterialId: string;
    gaugeProfileId: string;
    goldenMasterId: string;
  };
};

export type ResolvedPhysicalBodyV2 = {
  cord: {
    id: string;
    supplier: string;
    supplierSku: string;
    name: string;
    nominalDiameterMm: number;
    measuredDiameterMm: number;
    metersPerSpool: number;
    gramsPerMeter: number;
  };
  gauge: {
    id: string;
    stitchPatternId: string;
    hookSizeMm: number;
    tensionProfileId: string;
    stitchPitchXmm: number;
    rowPitchYmm: number;
    metersPerStitch: number;
    finishedThicknessMm: number | null;
  };
  goldenMaster: {
    id: string;
    family: string;
    productId: string | null;
    widthMm: number;
    heightMm: number;
    depthMm: number;
    stitchCount: number | null;
    rowCount: number | null;
    actualCordUsedMm: number;
    actualMassG: number;
  };
};

export type ProductConfigurationV2PhysicalValidation = {
  scope: "BODY_ONLY";
  bodyStatus: "BODY_VALIDATED" | "NOT_VALIDATED";
  fullProductStatus: "NOT_VALIDATED";
  sellable1to1: false;
  bodyBlockers: ConfiguratorValidationIssue[];
  fullProductBlockers: ConfiguratorValidationIssue[];
};

export type ProductConfigurationV2Sellability = {
  status: "CONSULTATION_ONLY";
  reasonCode: "FULL_PRODUCT_NOT_VALIDATED";
  message: string;
};

export type ResolvedProductConfigurationV2 = {
  schemaVersion: 2;
  resolverVersion: typeof PRODUCT_CONFIGURATION_V2_RESOLVER_VERSION;
  configurationHash: string;
  legacyProjectCode: string;
  status: "BODY_VALIDATED" | "BLOCKED";
  configuration: ProductConfigurationV2;
  validation: ConfiguratorValidationResult;
  physicalValidation: ProductConfigurationV2PhysicalValidation;
  resolvedPhysical: ResolvedPhysicalBodyV2 | null;
  sellability: ProductConfigurationV2Sellability;
  pricing: ConfiguratorPricingResult;
};

type EvidenceResolution = {
  bodyBlockers: ConfiguratorValidationIssue[];
  resolvedPhysical: ResolvedPhysicalBodyV2 | null;
};

function issue(code: string, message: string): ConfiguratorValidationIssue {
  return { code, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function physicalId(value: unknown, field: string) {
  if (typeof value !== "string") throw new ConfiguratorInputError(`Brak fizycznego powiązania: ${field}.`);
  const id = value.trim();
  if (!id || id.length > 160 || /[\u0000-\u001f\u007f]/.test(id)) {
    throw new ConfiguratorInputError(`Nieprawidłowe fizyczne powiązanie: ${field}.`);
  }
  return id;
}

function finitePositive(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function isProductConfigurationV2Source(source: unknown) {
  return isRecord(source) && source.schemaVersion === 2;
}

export function toProductConfigurationV2(source: unknown): ProductConfigurationV2 {
  if (!isRecord(source) || source.schemaVersion !== 2 || source.source !== "DIGITAL_CRAFT_TWIN") {
    throw new ConfiguratorInputError("Nieprawidłowy kontrakt ProductConfigurationV2.");
  }

  const selection = normalizeBagBuilderProjectConfig(source.selection);
  if (!selection) throw new ConfiguratorInputError("ProductConfigurationV2 zawiera nieobsługiwaną konfigurację wizualną.");
  if (!isRecord(source.physicalBinding)) throw new ConfiguratorInputError("Brak fizycznego powiązania ProductConfigurationV2.");

  return {
    schemaVersion: 2,
    source: "DIGITAL_CRAFT_TWIN",
    selection,
    physicalBinding: {
      cordMaterialId: physicalId(source.physicalBinding.cordMaterialId, "cordMaterialId"),
      gaugeProfileId: physicalId(source.physicalBinding.gaugeProfileId, "gaugeProfileId"),
      goldenMasterId: physicalId(source.physicalBinding.goldenMasterId, "goldenMasterId"),
    },
  };
}

function validateCord(cord: CordMaterialRecord | undefined, expectedId: string, blockers: ConfiguratorValidationIssue[]) {
  if (!cord) {
    blockers.push(issue("CORD_PROFILE_NOT_FOUND", `Nie znaleziono profilu materiału ${expectedId}.`));
    return false;
  }
  if (cord.status !== "VALIDATED") {
    blockers.push(issue("CORD_PROFILE_NOT_VALIDATED", "Wybrany sznurek nie ma zatwierdzonego profilu fizycznego."));
  }
  if (!finitePositive(cord.measuredDiameterMm)) {
    blockers.push(issue("CORD_DIAMETER_NOT_VALIDATED", "Brakuje zatwierdzonej zmierzonej średnicy sznurka."));
  }
  if (!finitePositive(cord.metersPerSpool)) {
    blockers.push(issue("CORD_SPOOL_LENGTH_NOT_VALIDATED", "Brakuje zatwierdzonej długości nawoju sznurka."));
  }
  if (!finitePositive(cord.gramsPerMeter)) {
    blockers.push(issue("CORD_MASS_NOT_VALIDATED", "Brakuje zatwierdzonej masy sznurka na metr."));
  }
  return true;
}

function validateGauge(
  gauge: GaugeProfileRecord | undefined,
  configuration: ProductConfigurationV2,
  blockers: ConfiguratorValidationIssue[],
) {
  if (!gauge) {
    blockers.push(issue("GAUGE_PROFILE_NOT_FOUND", `Nie znaleziono profilu Gauge ${configuration.physicalBinding.gaugeProfileId}.`));
    return false;
  }
  if (gauge.status !== "VALIDATED") {
    blockers.push(issue("GAUGE_PROFILE_NOT_VALIDATED", "Wybrany Gauge nie został zatwierdzony na fizycznej próbce."));
  }
  if (gauge.cordMaterialId !== configuration.physicalBinding.cordMaterialId) {
    blockers.push(issue("GAUGE_CORD_MISMATCH", "Gauge został wykonany innym sznurkiem niż wskazany w konfiguracji."));
  }
  if (gauge.stitchPatternId !== configuration.selection.stitch) {
    blockers.push(issue("GAUGE_STITCH_MISMATCH", "Gauge nie odpowiada ściegowi wybranemu przez klienta."));
  }
  if (!finitePositive(gauge.stitchPitchXmm) || !finitePositive(gauge.rowPitchYmm) || !finitePositive(gauge.metersPerStitch)) {
    blockers.push(issue("GAUGE_MEASUREMENTS_INVALID", "Gauge nie zawiera kompletnego, dodatniego zestawu pomiarów produkcyjnych."));
  }
  return true;
}

function validateGoldenMaster(
  master: GoldenMasterRecord | undefined,
  configuration: ProductConfigurationV2,
  blockers: ConfiguratorValidationIssue[],
) {
  if (!master) {
    blockers.push(issue("GOLDEN_MASTER_NOT_FOUND", `Nie znaleziono Golden Mastera ${configuration.physicalBinding.goldenMasterId}.`));
    return false;
  }
  if (master.status !== "VALIDATED") {
    blockers.push(issue("GOLDEN_MASTER_NOT_VALIDATED", "Wybrany Golden Master nie został zatwierdzony jako fizyczny wzorzec korpusu."));
  }
  if (master.bagFamily !== configuration.selection.family) {
    blockers.push(issue("GOLDEN_MASTER_FAMILY_MISMATCH", "Golden Master dotyczy innego fasonu niż konfiguracja klienta."));
  }
  if (master.stitchPatternId !== configuration.selection.stitch) {
    blockers.push(issue("GOLDEN_MASTER_STITCH_MISMATCH", "Golden Master został wykonany innym ściegiem niż konfiguracja klienta."));
  }
  if (master.cordMaterialId !== configuration.physicalBinding.cordMaterialId) {
    blockers.push(issue("GOLDEN_MASTER_CORD_MISMATCH", "Golden Master został wykonany innym sznurkiem niż wskazany w konfiguracji."));
  }
  if (master.gaugeProfileId !== configuration.physicalBinding.gaugeProfileId) {
    blockers.push(issue("GOLDEN_MASTER_GAUGE_MISMATCH", "Golden Master nie jest powiązany ze wskazanym profilem Gauge."));
  }
  if (!finitePositive(master.widthMm) || !finitePositive(master.heightMm) || !finitePositive(master.depthMm)) {
    blockers.push(issue("GOLDEN_MASTER_DIMENSIONS_INVALID", "Golden Master nie ma kompletnego zestawu dodatnich wymiarów fizycznych."));
  }
  if (!finitePositive(master.actualCordUsedMm) || !finitePositive(master.actualMassG)) {
    blockers.push(issue("GOLDEN_MASTER_CONSUMPTION_INVALID", "Golden Master nie ma zatwierdzonego rzeczywistego zużycia materiału i masy."));
  }
  return true;
}

function resolveBodyEvidence(
  configuration: ProductConfigurationV2,
  snapshot: CraftCalibrationSnapshot,
): EvidenceResolution {
  const blockers: ConfiguratorValidationIssue[] = [];
  const cord = snapshot.cords.find((item) => item.id === configuration.physicalBinding.cordMaterialId);
  const gauge = snapshot.gauges.find((item) => item.id === configuration.physicalBinding.gaugeProfileId);
  const master = snapshot.goldenMasters.find((item) => item.id === configuration.physicalBinding.goldenMasterId);

  validateCord(cord, configuration.physicalBinding.cordMaterialId, blockers);
  validateGauge(gauge, configuration, blockers);
  validateGoldenMaster(master, configuration, blockers);

  if (gauge && master) {
    if (gauge.cordMaterialId !== master.cordMaterialId) {
      blockers.push(issue("EVIDENCE_CHAIN_CORD_MISMATCH", "Gauge i Golden Master wskazują różne materiały."));
    }
    if (gauge.stitchPatternId !== master.stitchPatternId) {
      blockers.push(issue("EVIDENCE_CHAIN_STITCH_MISMATCH", "Gauge i Golden Master wskazują różne ściegi."));
    }
  }

  if (blockers.length || !cord || !gauge || !master) {
    return { bodyBlockers: blockers, resolvedPhysical: null };
  }

  return {
    bodyBlockers: [],
    resolvedPhysical: {
      cord: {
        id: cord.id,
        supplier: cord.supplier,
        supplierSku: cord.supplierSku,
        name: cord.name,
        nominalDiameterMm: cord.nominalDiameterMm,
        measuredDiameterMm: cord.measuredDiameterMm!,
        metersPerSpool: cord.metersPerSpool!,
        gramsPerMeter: cord.gramsPerMeter!,
      },
      gauge: {
        id: gauge.id,
        stitchPatternId: gauge.stitchPatternId,
        hookSizeMm: gauge.hookSizeMm,
        tensionProfileId: gauge.tensionProfileId,
        stitchPitchXmm: gauge.stitchPitchXmm,
        rowPitchYmm: gauge.rowPitchYmm,
        metersPerStitch: gauge.metersPerStitch,
        finishedThicknessMm: gauge.finishedThicknessMm,
      },
      goldenMaster: {
        id: master.id,
        family: master.bagFamily,
        productId: master.productId,
        widthMm: master.widthMm,
        heightMm: master.heightMm,
        depthMm: master.depthMm,
        stitchCount: master.stitchCount,
        rowCount: master.rowCount,
        actualCordUsedMm: master.actualCordUsedMm,
        actualMassG: master.actualMassG,
      },
    },
  };
}

const FULL_PRODUCT_BLOCKERS: ConfiguratorValidationIssue[] = [
  issue(
    "ACCESSORY_PROFILES_NOT_BOUND",
    "ProductConfigurationV2 nie wiąże jeszcze klap, pasków, uchwytów, okuć i dekoracji z zatwierdzonymi fizycznymi profilami SKU.",
  ),
  issue(
    "MOUNTING_PROFILES_NOT_BOUND",
    "Nie ma jeszcze zatwierdzonego łańcucha punktów mocowania, luzów, wzmocnień i nośności akcesoriów dla pełnego produktu.",
  ),
];

export async function resolveProductConfigurationV2(
  source: unknown,
  settings: BagBuilderSettings,
  calibration: CraftCalibrationSnapshot,
): Promise<ResolvedProductConfigurationV2> {
  const configuration = toProductConfigurationV2(source);
  const compatible = isBagBuilderProjectCompatible(configuration.selection, settings);
  const evidence = resolveBodyEvidence(configuration, calibration);
  const validationBlockers = [...evidence.bodyBlockers];
  if (!compatible) {
    validationBlockers.unshift(issue("BUILDER_INCOMPATIBLE", "Wybrana konfiguracja nie jest możliwa dla tego fasonu."));
  }

  const bodyValidated = compatible && evidence.bodyBlockers.length === 0 && evidence.resolvedPhysical !== null;
  const validation: ConfiguratorValidationResult = {
    valid: bodyValidated,
    blockers: validationBlockers,
    warnings: [],
  };

  return {
    schemaVersion: 2,
    resolverVersion: PRODUCT_CONFIGURATION_V2_RESOLVER_VERSION,
    configurationHash: await createConfigurationHash(configuration),
    legacyProjectCode: bagBuilderProjectCode(configuration.selection),
    status: bodyValidated ? "BODY_VALIDATED" : "BLOCKED",
    configuration,
    validation,
    physicalValidation: {
      scope: "BODY_ONLY",
      bodyStatus: bodyValidated ? "BODY_VALIDATED" : "NOT_VALIDATED",
      fullProductStatus: "NOT_VALIDATED",
      sellable1to1: false,
      bodyBlockers: evidence.bodyBlockers,
      fullProductBlockers: FULL_PRODUCT_BLOCKERS,
    },
    resolvedPhysical: bodyValidated ? evidence.resolvedPhysical : null,
    sellability: {
      status: "CONSULTATION_ONLY",
      reasonCode: "FULL_PRODUCT_NOT_VALIDATED",
      message: "Korpus ma osobny status walidacji fizycznej. Pełny zakup 1:1 pozostaje zablokowany do czasu zatwierdzenia akcesoriów i mocowań.",
    },
    pricing: resolveConfiguratorPricing(configuration.selection, settings),
  };
}
