import { BUILDER_COLORS, type BuilderColor } from "./bag-builder-settings";
import { getCraftCalibrationSnapshot } from "./craft-calibration";
import { getProductDb } from "./products";

export type CraftCordBuilderColorBinding = {
  cordMaterialId: string;
  builderColor: BuilderColor;
  updatedAt: string;
};

type BindingRow = {
  cord_material_id: string;
  builder_color: BuilderColor;
  updated_at: string;
};

const createTableSql = `
  CREATE TABLE IF NOT EXISTS craft_cord_builder_colors (
    cord_material_id TEXT PRIMARY KEY NOT NULL,
    builder_color TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

let readyPromise: Promise<void> | null = null;

function cleanId(value: unknown) {
  if (typeof value !== "string") throw new Error("Brak identyfikatora materiału sznurka.");
  const id = value.trim();
  if (!id || id.length > 160 || /[\u0000-\u001f\u007f]/.test(id)) throw new Error("Nieprawidłowy identyfikator materiału sznurka.");
  return id;
}

function builderColor(value: unknown): BuilderColor {
  if (typeof value !== "string" || !(BUILDER_COLORS as readonly string[]).includes(value)) {
    throw new Error("Nieprawidłowy kolor kreatora.");
  }
  return value as BuilderColor;
}

function mapBinding(row: BindingRow): CraftCordBuilderColorBinding {
  return {
    cordMaterialId: row.cord_material_id,
    builderColor: row.builder_color,
    updatedAt: row.updated_at,
  };
}

export async function ensureCraftCordColorBindingsReady() {
  readyPromise ??= getProductDb().prepare(createTableSql).run().then(() => undefined);
  try {
    await readyPromise;
  } catch (error) {
    readyPromise = null;
    throw error;
  }
}

export async function getCraftCordColorBindings(): Promise<CraftCordBuilderColorBinding[]> {
  await ensureCraftCordColorBindingsReady();
  const result = await getProductDb()
    .prepare("SELECT cord_material_id, builder_color, updated_at FROM craft_cord_builder_colors ORDER BY updated_at DESC")
    .all<BindingRow>();
  return result.results.map(mapBinding).filter((binding) =>
    (BUILDER_COLORS as readonly string[]).includes(binding.builderColor),
  );
}

export async function saveCraftCordColorBinding(source: unknown) {
  const raw = typeof source === "object" && source ? source as Record<string, unknown> : {};
  const cordMaterialId = cleanId(raw.cordMaterialId);
  const color = builderColor(raw.builderColor);

  const calibration = await getCraftCalibrationSnapshot();
  const cord = calibration.cords.find((item) => item.id === cordMaterialId);
  if (!cord) throw new Error("Wybrany materiał sznurka nie istnieje.");
  if (cord.status !== "VALIDATED") {
    throw new Error("Kolor kreatora można przypisać dopiero do zatwierdzonego materiału sznurka.");
  }

  await ensureCraftCordColorBindingsReady();
  const now = new Date().toISOString();
  await getProductDb().prepare(`INSERT INTO craft_cord_builder_colors (cord_material_id, builder_color, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(cord_material_id) DO UPDATE SET builder_color = excluded.builder_color, updated_at = excluded.updated_at`)
    .bind(cordMaterialId, color, now)
    .run();

  return { cordMaterialId, builderColor: color, updatedAt: now } satisfies CraftCordBuilderColorBinding;
}

export function findCraftCordBuilderColor(
  bindings: readonly CraftCordBuilderColorBinding[],
  cordMaterialId: string,
) {
  return bindings.find((binding) => binding.cordMaterialId === cordMaterialId)?.builderColor ?? null;
}
