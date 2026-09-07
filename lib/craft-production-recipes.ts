import {
  BUILDER_FAMILIES,
  BUILDER_STITCHES,
  type BuilderFamily,
  type BuilderStitch,
} from "./bag-builder-settings";
import { BUILDER_ACCESSORY_SLOTS, type BuilderAccessorySlot } from "./craft-builder-accessory-bindings";
import { getProductDb } from "./products";

export const CRAFT_PRODUCTION_STEP_TYPES = ["CROCHET", "JOIN", "ATTACH", "SEW", "FINISH", "QC"] as const;
export type CraftProductionStepType = (typeof CRAFT_PRODUCTION_STEP_TYPES)[number];
export type CraftProductionRecipeStatus = "DRAFT" | "VALIDATED";

export type CraftProductionStepRecord = {
  id: string;
  recipeId: string;
  stepOrder: number;
  stepType: CraftProductionStepType;
  appliesToSlot: BuilderAccessorySlot | null;
  instruction: string;
  qcCriterion: string;
};

export type CraftProductionRecipeRecord = {
  id: string;
  bagFamily: BuilderFamily;
  stitchPatternId: BuilderStitch;
  version: number;
  name: string;
  status: CraftProductionRecipeStatus;
  steps: CraftProductionStepRecord[];
  createdAt: string;
  updatedAt: string;
};

type RecipeRow = {
  id: string;
  bag_family: BuilderFamily;
  stitch_pattern_id: BuilderStitch;
  version: number;
  name: string;
  status: CraftProductionRecipeStatus;
  created_at: string;
  updated_at: string;
};

type StepRow = {
  id: string;
  recipe_id: string;
  step_order: number;
  step_type: CraftProductionStepType;
  applies_to_slot: BuilderAccessorySlot | null;
  instruction: string;
  qc_criterion: string;
};

const createRecipesSql = `
  CREATE TABLE IF NOT EXISTS craft_production_recipes (
    id TEXT PRIMARY KEY NOT NULL,
    bag_family TEXT NOT NULL,
    stitch_pattern_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(bag_family, stitch_pattern_id, version)
  )
`;

const createStepsSql = `
  CREATE TABLE IF NOT EXISTS craft_production_steps (
    id TEXT PRIMARY KEY NOT NULL,
    recipe_id TEXT NOT NULL,
    step_order INTEGER NOT NULL,
    step_type TEXT NOT NULL,
    applies_to_slot TEXT,
    instruction TEXT NOT NULL,
    qc_criterion TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(recipe_id, step_order)
  )
`;

let readyPromise: Promise<void> | null = null;

function cleanText(value: unknown, field: string, max = 2000) {
  if (typeof value !== "string") throw new Error(`Brak pola: ${field}.`);
  const result = value.trim();
  if (!result || result.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(result)) {
    throw new Error(`Nieprawidłowe pole: ${field}.`);
  }
  return result;
}

function optionalText(value: unknown, max = 2000) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value !== "string") throw new Error("Nieprawidłowa wartość tekstowa.");
  const result = value.trim();
  if (result.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(result)) {
    throw new Error("Nieprawidłowa wartość tekstowa.");
  }
  return result;
}

function positiveInteger(value: unknown, field: string, max = 100_000) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0 || number > max) throw new Error(`Nieprawidłowe pole: ${field}.`);
  return number;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) throw new Error(`Nieprawidłowe pole: ${field}.`);
  return value as T;
}

function optionalSlot(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return enumValue(value, BUILDER_ACCESSORY_SLOTS, "appliesToSlot");
}

function parseSteps(source: unknown) {
  if (!Array.isArray(source)) throw new Error("Receptura musi zawierać listę kroków.");
  if (source.length > 100) throw new Error("Receptura zawiera zbyt wiele kroków.");
  return source.map((item, index) => {
    const raw = typeof item === "object" && item ? item as Record<string, unknown> : {};
    const stepType = enumValue(raw.stepType, CRAFT_PRODUCTION_STEP_TYPES, `steps[${index}].stepType`);
    const appliesToSlot = optionalSlot(raw.appliesToSlot);
    if (stepType === "ATTACH" && !appliesToSlot) {
      throw new Error("Każdy krok ATTACH musi wskazywać konkretny slot akcesorium.");
    }
    if (stepType !== "ATTACH" && appliesToSlot) {
      throw new Error("appliesToSlot jest dozwolone wyłącznie dla kroku ATTACH.");
    }
    return {
      stepOrder: index + 1,
      stepType,
      appliesToSlot,
      instruction: cleanText(raw.instruction, `steps[${index}].instruction`),
      qcCriterion: optionalText(raw.qcCriterion),
    };
  });
}

function assertValidatedRecipe(steps: ReturnType<typeof parseSteps>) {
  const types = new Set(steps.map((step) => step.stepType));
  for (const required of ["CROCHET", "FINISH", "QC"] as const) {
    if (!types.has(required)) throw new Error(`Zatwierdzona receptura wymaga kroku ${required}.`);
  }
  if (!steps.some((step) => step.stepType === "ATTACH" && step.appliesToSlot === "hardware")) {
    throw new Error("Zatwierdzona receptura wymaga jawnego kroku ATTACH dla okuć.");
  }
  if (!steps.some((step) => step.stepType === "QC" && step.qcCriterion.length > 0)) {
    throw new Error("Zatwierdzona receptura wymaga co najmniej jednego jawnego kryterium QC.");
  }
}

function mapStep(row: StepRow): CraftProductionStepRecord {
  return {
    id: row.id,
    recipeId: row.recipe_id,
    stepOrder: row.step_order,
    stepType: row.step_type,
    appliesToSlot: row.applies_to_slot,
    instruction: row.instruction,
    qcCriterion: row.qc_criterion,
  };
}

export async function ensureCraftProductionRecipesReady() {
  readyPromise ??= (async () => {
    const db = getProductDb();
    await db.prepare(createRecipesSql).run();
    await db.prepare(createStepsSql).run();
  })();
  try {
    await readyPromise;
  } catch (error) {
    readyPromise = null;
    throw error;
  }
}

export async function getCraftProductionRecipes(): Promise<CraftProductionRecipeRecord[]> {
  await ensureCraftProductionRecipesReady();
  const db = getProductDb();
  const [recipesResult, stepsResult] = await Promise.all([
    db.prepare("SELECT * FROM craft_production_recipes ORDER BY bag_family, stitch_pattern_id, version DESC").all<RecipeRow>(),
    db.prepare("SELECT * FROM craft_production_steps ORDER BY recipe_id, step_order").all<StepRow>(),
  ]);
  const steps = stepsResult.results.map(mapStep);
  return recipesResult.results.map((row) => ({
    id: row.id,
    bagFamily: row.bag_family,
    stitchPatternId: row.stitch_pattern_id,
    version: row.version,
    name: row.name,
    status: row.status,
    steps: steps.filter((step) => step.recipeId === row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createCraftProductionRecipe(source: unknown) {
  const raw = typeof source === "object" && source ? source as Record<string, unknown> : {};
  const bagFamily = enumValue(raw.bagFamily, BUILDER_FAMILIES, "bagFamily");
  const stitchPatternId = enumValue(raw.stitchPatternId, BUILDER_STITCHES, "stitchPatternId");
  const version = positiveInteger(raw.version, "version");
  const name = cleanText(raw.name, "name", 200);
  const status: CraftProductionRecipeStatus = raw.status === "VALIDATED" ? "VALIDATED" : "DRAFT";
  const steps = parseSteps(raw.steps);
  if (status === "VALIDATED") assertValidatedRecipe(steps);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await ensureCraftProductionRecipesReady();
  const db = getProductDb();
  await db.prepare(`INSERT INTO craft_production_recipes
    (id, bag_family, stitch_pattern_id, version, name, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, bagFamily, stitchPatternId, version, name, status, now, now)
    .run();

  try {
    for (const step of steps) {
      await db.prepare(`INSERT INTO craft_production_steps
        (id, recipe_id, step_order, step_type, applies_to_slot, instruction, qc_criterion, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(crypto.randomUUID(), id, step.stepOrder, step.stepType, step.appliesToSlot, step.instruction, step.qcCriterion, now)
        .run();
    }
  } catch (error) {
    await db.prepare("DELETE FROM craft_production_steps WHERE recipe_id = ?").bind(id).run();
    await db.prepare("DELETE FROM craft_production_recipes WHERE id = ?").bind(id).run();
    throw error;
  }

  return (await getCraftProductionRecipes()).find((recipe) => recipe.id === id)!;
}
