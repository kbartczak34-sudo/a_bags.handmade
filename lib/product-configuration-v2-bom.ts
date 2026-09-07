import type { BagBuilderSettings } from "./bag-builder-settings";
import type { CraftCalibrationSnapshot } from "./craft-calibration";
import type { CraftCordBuilderColorBinding } from "./craft-color-bindings";
import type { CraftAccessorySnapshot } from "./craft-accessories";
import type { CraftBuilderAccessoryBindingRecord, BuilderAccessorySlot } from "./craft-builder-accessory-bindings";
import type { CraftAccessoryBomUsageRecord, CraftBomUnit } from "./craft-builder-accessory-bom-usage";
import type { CraftProductionRecipeRecord } from "./craft-production-recipes";
import { createConfigurationHash, type ConfiguratorValidationIssue } from "./configurator-resolver";
import { resolveProductionRecipeBoundProductConfigurationV2 } from "./product-configuration-v2-production-recipe";

export type ProductionBomCordItemV2 = {
  kind: "CORD";
  cordMaterialId: string;
  supplier: string;
  supplierSku: string;
  name: string;
  measuredDiameterMm: number;
  quantity: number;
  unit: "METER";
  source: "GOLDEN_MASTER_ACTUAL_USAGE";
};

export type ProductionBomAccessoryItemV2 = {
  kind: "ACCESSORY";
  slot: BuilderAccessorySlot;
  builderValue: string;
  bindingId: string;
  accessoryId: string;
  mountingProfileId: string;
  sku: string;
  name: string;
  material: string;
  quantity: number;
  unit: CraftBomUnit;
  usageStatus: "VALIDATED";
};

export type ProductionBomV2 = {
  schemaVersion: 1;
  cord: ProductionBomCordItemV2;
  accessories: ProductionBomAccessoryItemV2[];
  recipe: {
    id: string;
    version: number;
    name: string;
  };
};

export type BomValidationV2 = {
  status: "BOM_VALIDATED" | "NOT_VALIDATED";
  blockers: ConfiguratorValidationIssue[];
  bom: ProductionBomV2 | null;
};

function issue(code: string, message: string): ConfiguratorValidationIssue {
  return { code, message };
}

function validUsage(usage: CraftAccessoryBomUsageRecord | undefined) {
  return Boolean(
    usage
    && usage.status === "VALIDATED"
    && Number.isFinite(usage.quantity)
    && usage.quantity > 0
    && ["PIECE", "SET", "METER"].includes(usage.unit),
  );
}

export async function resolveBomBoundProductConfigurationV2(
  source: unknown,
  settings: BagBuilderSettings,
  calibration: CraftCalibrationSnapshot,
  colorBindings: readonly CraftCordBuilderColorBinding[],
  accessoryBindings: readonly CraftBuilderAccessoryBindingRecord[],
  accessorySnapshot: CraftAccessorySnapshot,
  recipes: readonly CraftProductionRecipeRecord[],
  bomUsage: readonly CraftAccessoryBomUsageRecord[],
) {
  const base = await resolveProductionRecipeBoundProductConfigurationV2(
    source,
    settings,
    calibration,
    colorBindings,
    accessoryBindings,
    accessorySnapshot,
    recipes,
  );

  const blockers: ConfiguratorValidationIssue[] = [];
  if (base.productionRecipeValidation.status !== "PRODUCTION_RECIPE_VALIDATED") {
    blockers.push(issue(
      "PRODUCTION_RECIPE_REQUIRED_FOR_BOM",
      "BOM nie może zostać zatwierdzony bez kompletnej zwalidowanej receptury produkcyjnej.",
    ));
  }
  if (!base.resolvedPhysical) {
    blockers.push(issue("BODY_EVIDENCE_REQUIRED_FOR_BOM", "BOM wymaga zwalidowanego fizycznego korpusu."));
  }

  const accessoryItems: ProductionBomAccessoryItemV2[] = [];
  for (const resolved of base.accessoryValidation.resolved) {
    const usage = bomUsage.find((item) => item.bindingId === resolved.bindingId);
    if (!validUsage(usage)) {
      blockers.push(issue(
        `BOM_USAGE_NOT_VALIDATED_${resolved.slot.toUpperCase()}`,
        `Brakuje zatwierdzonej ilości BOM dla SKU ${resolved.accessory.sku} (${resolved.slot}).`,
      ));
      continue;
    }
    accessoryItems.push({
      kind: "ACCESSORY",
      slot: resolved.slot,
      builderValue: resolved.builderValue,
      bindingId: resolved.bindingId,
      accessoryId: resolved.accessory.id,
      mountingProfileId: resolved.mounting.id,
      sku: resolved.accessory.sku,
      name: resolved.accessory.name,
      material: resolved.accessory.material,
      quantity: usage!.quantity,
      unit: usage!.unit,
      usageStatus: "VALIDATED",
    });
  }

  const expectedAccessoryCount = base.accessoryValidation.requiredSlots.length;
  if (accessoryItems.length !== expectedAccessoryCount) {
    blockers.push(issue(
      "BOM_ACCESSORY_COVERAGE_INCOMPLETE",
      "BOM nie pokrywa wszystkich aktywnych fizycznych akcesoriów konfiguracji.",
    ));
  }

  let bom: ProductionBomV2 | null = null;
  const recipe = base.productionRecipeValidation;
  if (blockers.length === 0 && base.resolvedPhysical && recipe.recipeId && recipe.recipeVersion && recipe.recipeName) {
    const actualCordUsedMm = base.resolvedPhysical.goldenMaster.actualCordUsedMm;
    if (!Number.isFinite(actualCordUsedMm) || actualCordUsedMm <= 0) {
      blockers.push(issue("BOM_CORD_USAGE_INVALID", "Golden Master nie zawiera dodatniego rzeczywistego zużycia sznurka."));
    } else {
      bom = {
        schemaVersion: 1,
        cord: {
          kind: "CORD",
          cordMaterialId: base.resolvedPhysical.cord.id,
          supplier: base.resolvedPhysical.cord.supplier,
          supplierSku: base.resolvedPhysical.cord.supplierSku,
          name: base.resolvedPhysical.cord.name,
          measuredDiameterMm: base.resolvedPhysical.cord.measuredDiameterMm,
          quantity: actualCordUsedMm / 1000,
          unit: "METER",
          source: "GOLDEN_MASTER_ACTUAL_USAGE",
        },
        accessories: accessoryItems,
        recipe: {
          id: recipe.recipeId,
          version: recipe.recipeVersion,
          name: recipe.recipeName,
        },
      };
    }
  }

  const bomValidated = blockers.length === 0 && bom !== null;
  const bomValidation: BomValidationV2 = {
    status: bomValidated ? "BOM_VALIDATED" : "NOT_VALIDATED",
    blockers,
    bom: bomValidated ? bom : null,
  };

  const productionPackagePreview = bomValidated ? {
    schemaVersion: 1 as const,
    configurationHash: base.configurationHash,
    configuration: base.configuration,
    resolvedPhysical: base.resolvedPhysical,
    accessoryEvidence: base.accessoryValidation.resolved,
    bom,
    productionRecipe: {
      id: base.productionRecipeValidation.recipeId,
      version: base.productionRecipeValidation.recipeVersion,
      name: base.productionRecipeValidation.recipeName,
      compiledSteps: base.productionRecipeValidation.compiledSteps,
    },
    pricing: base.pricing,
  } : null;
  const productionPackageHash = productionPackagePreview
    ? await createConfigurationHash(productionPackagePreview)
    : null;

  const nextBoundary = issue(
    "PRODUCTION_SNAPSHOT_NOT_PERSISTED",
    "Kompletny pakiet produkcyjny musi zostać niezmiennie zapisany po stronie serwera i powiązany z przyszłą płatnością.",
  );

  return {
    ...base,
    status: bomValidated ? base.status : "BLOCKED" as const,
    validation: {
      ...base.validation,
      valid: base.validation.valid && bomValidated,
      blockers: [...base.validation.blockers, ...blockers],
    },
    physicalValidation: {
      ...base.physicalValidation,
      fullProductBlockers: bomValidated ? [nextBoundary] : [...blockers, nextBoundary],
    },
    bomValidation,
    productionPackagePreview,
    productionPackageHash,
    sellability: {
      ...base.sellability,
      message: bomValidated
        ? "Korpus, akcesoria, mocowania, receptura i BOM są zwalidowane. Zakup 1:1 pozostaje zablokowany do czasu utrwalenia immutable Production Snapshot i bezpiecznego powiązania go z płatnością."
        : "Zakup 1:1 pozostaje zablokowany: BOM nie ma kompletnego zatwierdzonego pokrycia wszystkich materiałów i akcesoriów.",
    },
  };
}
