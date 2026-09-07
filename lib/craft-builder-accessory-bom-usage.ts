import { getCraftBuilderAccessoryBindings, type CraftBuilderAccessoryBindingRecord } from "./craft-builder-accessory-bindings";
import { getProductDb } from "./products";

export const CRAFT_BOM_UNITS = ["PIECE", "SET", "METER"] as const;
export type CraftBomUnit = (typeof CRAFT_BOM_UNITS)[number];
export type CraftAccessoryBomUsageStatus = "DRAFT" | "VALIDATED";

export type CraftAccessoryBomUsageRecord = {
  bindingId: string;
  quantity: number;
  unit: CraftBomUnit;
  status: CraftAccessoryBomUsageStatus;
  createdAt: string;
  updatedAt: string;
};

type UsageRow = {
  binding_id: string;
  quantity: number;
  unit: CraftBomUnit;
  status: CraftAccessoryBomUsageStatus;
  created_at: string;
  updated_at: string;
};

const createTableSql = `
  CREATE TABLE IF NOT EXISTS craft_builder_accessory_bom_usage (
    binding_id TEXT PRIMARY KEY NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

let readyPromise: Promise<void> | null = null;

function cleanId(value: unknown, field: string) {
  if (typeof value !== "string") throw new Error(`Brak pola: ${field}.`);
  const result = value.trim();
  if (!result || result.length > 160 || /[\u0000-\u001f\u007f]/.test(result)) throw new Error(`Nieprawidłowe pole: ${field}.`);
  return result;
}

function positiveQuantity(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || number > 1_000_000) {
    throw new Error("Ilość BOM musi być dodatnią, jawnie podaną wartością.");
  }
  return number;
}

function unitValue(value: unknown): CraftBomUnit {
  if (typeof value !== "string" || !(CRAFT_BOM_UNITS as readonly string[]).includes(value)) {
    throw new Error("Nieobsługiwana jednostka BOM.");
  }
  return value as CraftBomUnit;
}

function mapUsage(row: UsageRow): CraftAccessoryBomUsageRecord {
  return {
    bindingId: row.binding_id,
    quantity: row.quantity,
    unit: row.unit,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function ensureCraftAccessoryBomUsageReady() {
  readyPromise ??= (async () => {
    await getProductDb().prepare(createTableSql).run();
  })();
  try {
    await readyPromise;
  } catch (error) {
    readyPromise = null;
    throw error;
  }
}

export async function getCraftAccessoryBomUsage() {
  await ensureCraftAccessoryBomUsageReady();
  const result = await getProductDb()
    .prepare("SELECT * FROM craft_builder_accessory_bom_usage ORDER BY binding_id")
    .all<UsageRow>();
  return result.results.map(mapUsage);
}

function findBinding(bindings: readonly CraftBuilderAccessoryBindingRecord[], bindingId: string) {
  return bindings.find((binding) => binding.id === bindingId);
}

export async function upsertCraftAccessoryBomUsage(source: unknown) {
  const raw = typeof source === "object" && source ? source as Record<string, unknown> : {};
  const bindingId = cleanId(raw.bindingId, "bindingId");
  const quantity = positiveQuantity(raw.quantity);
  const unit = unitValue(raw.unit);
  const status: CraftAccessoryBomUsageStatus = raw.status === "VALIDATED" ? "VALIDATED" : "DRAFT";

  const bindings = await getCraftBuilderAccessoryBindings();
  const binding = findBinding(bindings, bindingId);
  if (!binding) throw new Error("Wybrany binding akcesorium nie istnieje.");
  if (status === "VALIDATED" && binding.status !== "VALIDATED") {
    throw new Error("Zużycie BOM można zatwierdzić dopiero dla zatwierdzonego bindingu akcesorium.");
  }

  await ensureCraftAccessoryBomUsageReady();
  const existing = await getProductDb()
    .prepare("SELECT created_at FROM craft_builder_accessory_bom_usage WHERE binding_id = ? LIMIT 1")
    .bind(bindingId)
    .first<{ created_at: string }>();
  const createdAt = existing?.created_at ?? new Date().toISOString();
  const updatedAt = new Date().toISOString();

  await getProductDb().prepare(`INSERT INTO craft_builder_accessory_bom_usage
    (binding_id, quantity, unit, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(binding_id) DO UPDATE SET
      quantity = excluded.quantity,
      unit = excluded.unit,
      status = excluded.status,
      updated_at = excluded.updated_at`)
    .bind(bindingId, quantity, unit, status, createdAt, updatedAt)
    .run();

  return (await getCraftAccessoryBomUsage()).find((item) => item.bindingId === bindingId)!;
}
