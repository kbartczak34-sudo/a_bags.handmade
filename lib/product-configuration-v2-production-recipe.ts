import type { BagBuilderSettings } from "./bag-builder-settings";
import type { CraftCalibrationSnapshot } from "./craft-calibration";
import type { CraftCordBuilderColorBinding } from "./craft-color-bindings";
import type { CraftAccessorySnapshot } from "./craft-accessories";
import type { CraftBuilderAccessoryBindingRecord, BuilderAccessorySlot } from "./craft-builder-accessory-bindings";
import type { CraftProductionRecipeRecord, CraftProductionStepRecord } from "./craft-production-recipes";
import type { ConfiguratorValidationIssue } from "./configurator-resolver";
import { resolveAccessoryBoundProductConfigurationV2 } from "./product-configuration-v2-accessories";

export type CompiledProductionStepV2 = {
  sourceStepId: string;
  sourceOrder: number;
  compiledOrder: number;
  stepType: CraftProductionStepRecord["stepType"];
  appliesToSlot: BuilderAccessorySlot | null;
  instruction: string;
  qcCriterion: string;
  accessoryBinding: null | {
    sku: string;
    accessoryId: string;
    mountingProfileId: string;
  };
};

export type ProductionRecipeValidationV2 = {
  status: "PRODUCTION_RECIPE_VALIDATED" | "NOT_VALIDATED";
  recipeId: string | null;
  recipeVersion: number | null;
  recipeName: string | null;
  blockers: ConfiguratorValidationIssue[];
  compiledSteps: CompiledProductionStepV2[];
};

function issue(code: string, message: string): ConfiguratorValidationIssue {
  return { code, message };
}

function coreRecipeBlockers(recipe: CraftProductionRecipeRecord) {
  const blockers: ConfiguratorValidationIssue[] = [];
  if (recipe.status !== "VALIDATED") {
    blockers.push(issue("PRODUCTION_RECIPE_NOT_VALIDATED", "Wybrana receptura produkcyjna nie ma statusu VALIDATED."));
  }
  if (!Number.isInteger(recipe.version) || recipe.version <= 0) {
    blockers.push(issue("PRODUCTION_RECIPE_VERSION_INVALID", "Receptura produkcyjna ma nieprawidłowy numer wersji."));
  }
  if (!recipe.steps.every((step, index) => step.stepOrder === index + 1)) {
    blockers.push(issue("PRODUCTION_RECIPE_ORDER_INVALID", "Kolejność kroków receptury nie jest ciągła i jednoznaczna."));
  }
  const types = new Set(recipe.steps.map((step) => step.stepType));
  for (const required of ["CROCHET", "FINISH", "QC"] as const) {
    if (!types.has(required)) blockers.push(issue(`PRODUCTION_RECIPE_${required}_MISSING`, `Receptura nie zawiera wymaganego kroku ${required}.`));
  }
  if (!recipe.steps.some((step) => step.stepType === "QC" && step.qcCriterion.trim().length > 0)) {
    blockers.push(issue("PRODUCTION_RECIPE_QC_CRITERION_MISSING", "Receptura nie zawiera jawnego kryterium kontroli jakości."));
  }
  if (!recipe.steps.some((step) => step.stepType === "ATTACH" && step.appliesToSlot === "hardware")) {
    blockers.push(issue("PRODUCTION_RECIPE_HARDWARE_ATTACH_MISSING", "Receptura nie zawiera jawnego kroku montażu okuć."));
  }
  if (recipe.steps.some((step) => !step.instruction.trim())) {
    blockers.push(issue("PRODUCTION_RECIPE_INSTRUCTION_MISSING", "Co najmniej jeden krok receptury nie zawiera instrukcji pracowni."));
  }
  return blockers;
}

function selectRecipe(
  recipes: readonly CraftProductionRecipeRecord[],
  family: string,
  stitch: string,
) {
  return recipes
    .filter((recipe) => recipe.status === "VALIDATED" && recipe.bagFamily === family && recipe.stitchPatternId === stitch)
    .sort((left, right) => right.version - left.version)[0] ?? null;
}

export async function resolveProductionRecipeBoundProductConfigurationV2(
  source: unknown,
  settings: BagBuilderSettings,
  calibration: CraftCalibrationSnapshot,
  colorBindings: readonly CraftCordBuilderColorBinding[],
  accessoryBindings: readonly CraftBuilderAccessoryBindingRecord[],
  accessorySnapshot: CraftAccessorySnapshot,
  recipes: readonly CraftProductionRecipeRecord[],
) {
  const base = await resolveAccessoryBoundProductConfigurationV2(
    source,
    settings,
    calibration,
    colorBindings,
    accessoryBindings,
    accessorySnapshot,
  );

  const blockers: ConfiguratorValidationIssue[] = [];
  const recipe = selectRecipe(recipes, base.configuration.selection.family, base.configuration.selection.stitch);
  if (!recipe) {
    blockers.push(issue(
      "PRODUCTION_RECIPE_MISSING",
      `Brakuje zatwierdzonej receptury dla fasonu ${base.configuration.selection.family} i ściegu ${base.configuration.selection.stitch}.`,
    ));
  }

  if (base.accessoryValidation.status !== "ACCESSORIES_VALIDATED") {
    blockers.push(issue(
      "ACCESSORY_EVIDENCE_REQUIRED_FOR_RECIPE_COMPILATION",
      "Receptura nie może zostać skompilowana do pełnego produktu bez zatwierdzonych dowodów wszystkich wybranych akcesoriów.",
    ));
  }

  if (recipe) {
    blockers.push(...coreRecipeBlockers(recipe));
    for (const required of base.accessoryValidation.requiredSlots) {
      const covered = recipe.steps.some((step) => step.stepType === "ATTACH" && step.appliesToSlot === required.slot);
      if (!covered) {
        blockers.push(issue(
          `PRODUCTION_RECIPE_ATTACH_MISSING_${required.slot.toUpperCase()}`,
          `Receptura nie zawiera kroku ATTACH dla wybranej opcji ${required.slot}=${required.builderValue}.`,
        ));
      }
    }
  }

  const activeSlots = new Set(base.accessoryValidation.requiredSlots.map((item) => item.slot));
  const compiledSteps: CompiledProductionStepV2[] = [];
  if (recipe && blockers.length === 0) {
    for (const step of recipe.steps) {
      if (step.stepType === "ATTACH" && step.appliesToSlot && !activeSlots.has(step.appliesToSlot)) continue;
      const resolvedAccessory = step.appliesToSlot
        ? base.accessoryValidation.resolved.find((item) => item.slot === step.appliesToSlot)
        : undefined;
      compiledSteps.push({
        sourceStepId: step.id,
        sourceOrder: step.stepOrder,
        compiledOrder: compiledSteps.length + 1,
        stepType: step.stepType,
        appliesToSlot: step.appliesToSlot,
        instruction: step.instruction,
        qcCriterion: step.qcCriterion,
        accessoryBinding: resolvedAccessory ? {
          sku: resolvedAccessory.accessory.sku,
          accessoryId: resolvedAccessory.accessory.id,
          mountingProfileId: resolvedAccessory.mounting.id,
        } : null,
      });
    }
  }

  const recipeValidated = Boolean(recipe) && blockers.length === 0 && compiledSteps.length > 0;
  const productionRecipeValidation: ProductionRecipeValidationV2 = {
    status: recipeValidated ? "PRODUCTION_RECIPE_VALIDATED" : "NOT_VALIDATED",
    recipeId: recipe?.id ?? null,
    recipeVersion: recipe?.version ?? null,
    recipeName: recipe?.name ?? null,
    blockers,
    compiledSteps,
  };

  const nextBoundary = issue(
    "BOM_AND_PRODUCTION_SNAPSHOT_NOT_COMPILED",
    "Zatwierdzona receptura musi jeszcze zostać połączona z kompletnym BOM i niezmiennym snapshotem produkcyjnym zamówienia.",
  );

  return {
    ...base,
    status: recipeValidated ? base.status : "BLOCKED" as const,
    validation: {
      ...base.validation,
      valid: base.validation.valid && recipeValidated,
      blockers: [...base.validation.blockers, ...blockers],
    },
    physicalValidation: {
      ...base.physicalValidation,
      fullProductBlockers: recipeValidated ? [nextBoundary] : [...blockers, nextBoundary],
    },
    productionRecipeValidation,
    sellability: {
      ...base.sellability,
      message: recipeValidated
        ? "Korpus, akcesoria, mocowania i receptura produkcyjna są zwalidowane. Zakup 1:1 pozostaje zablokowany do czasu skompilowania kompletnego BOM i immutable Production Snapshot."
        : "Zakup 1:1 pozostaje zablokowany: nie ma kompletnej zwalidowanej receptury produkcyjnej pokrywającej tę konfigurację.",
    },
  };
}
