import {
  BUILDER_ACCENTS,
  BUILDER_FAMILIES,
  BUILDER_FLAPS,
  BUILDER_HANDLES,
  BUILDER_HARDWARE,
  BUILDER_STRAPS,
  type BuilderFamily,
} from "./bag-builder-settings";
import {
  getCraftAccessorySnapshot,
  type CraftAccessoryKind,
  type CraftAccessoryStatus,
} from "./craft-accessories";
import { getProductDb } from "./products";

export const BUILDER_ACCESSORY_SLOTS = ["flap", "handles", "strap", "hardware", "accent"] as const;
export type BuilderAccessorySlot = (typeof BUILDER_ACCESSORY_SLOTS)[number];
export type BuilderAccessoryBindingStatus = "DRAFT" | "VALIDATED";

const SLOT_VALUES: Record<BuilderAccessorySlot, readonly string[]> = {
  flap: BUILDER_FLAPS,
  handles: BUILDER_HANDLES,
  strap: BUILDER_STRAPS,
  hardware: BUILDER_HARDWARE,
  accent: BUILDER_ACCENTS,
};

const SLOT_KINDS: Record<BuilderAccessorySlot, CraftAccessoryKind> = {
  flap: "FLAP",
  handles: "HANDLE",
  strap: "STRAP",
  hardware: "HARDWARE",
  accent: "ACCENT",
};

export type CraftBuilderAccessoryBindingRecord = {
  id: string;
  slot: BuilderAccessorySlot;
  builderValue: string;
  bagFamily: BuilderFamily;
  accessoryId: string;
  mountingProfileId: string;
  status: BuilderAccessoryBindingStatus;
  createdAt: string;
  updatedAt: string;
};

type BindingRow = {
  id: string;
  slot: BuilderAccessorySlot;
  builder_value: string;
  bag_family: BuilderFamily;
  accessory_id: string;
  mounting_profile_id: string;
  status: BuilderAccessoryBindingStatus;
  created_at: string;
  updated_at: string;
};

const createTableSql = `
  CREATE TABLE IF NOT EXISTS craft_builder_accessory_bindings (
    id TEXT PRIMARY KEY NOT NULL,
    slot TEXT NOT NULL,
    builder_value TEXT NOT NULL,
    bag_family TEXT NOT NULL,
    accessory_id TEXT NOT NULL,
    mounting_profile_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(slot, builder_value, bag_family)
  )
`;

let readyPromise: Promise<void> | null = null;

function cleanText(value: unknown, field: string, max = 160) {
  if (typeof value !== "string") throw new Error(`Brak pola: ${field}.`);
  const result = value.trim();
  if (!result || result.length > max || /[\u0000-\u001f\u007f]/.test(result)) throw new Error(`Nieprawidłowe pole: ${field}.`);
  return result;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) throw new Error(`Nieprawidłowe pole: ${field}.`);
  return value as T;
}

function mapBinding(row: BindingRow): CraftBuilderAccessoryBindingRecord {
  return {
    id: row.id,
    slot: row.slot,
    builderValue: row.builder_value,
    bagFamily: row.bag_family,
    accessoryId: row.accessory_id,
    mountingProfileId: row.mounting_profile_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function ensureCraftBuilderAccessoryBindingsReady() {
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

export async function getCraftBuilderAccessoryBindings() {
  await ensureCraftBuilderAccessoryBindingsReady();
  const result = await getProductDb()
    .prepare("SELECT * FROM craft_builder_accessory_bindings ORDER BY slot, builder_value, bag_family")
    .all<BindingRow>();
  return result.results.map(mapBinding);
}

export async function upsertCraftBuilderAccessoryBinding(source: unknown) {
  const raw = typeof source === "object" && source ? source as Record<string, unknown> : {};
  const slot = enumValue(raw.slot, BUILDER_ACCESSORY_SLOTS, "slot");
  const builderValue = enumValue(raw.builderValue, SLOT_VALUES[slot], "builderValue");
  const bagFamily = enumValue(raw.bagFamily, BUILDER_FAMILIES, "bagFamily");
  const accessoryId = cleanText(raw.accessoryId, "accessoryId");
  const mountingProfileId = cleanText(raw.mountingProfileId, "mountingProfileId");
  const status: BuilderAccessoryBindingStatus = raw.status === "VALIDATED" ? "VALIDATED" : "DRAFT";

  if (builderValue === "none") {
    throw new Error("Opcja 'none' nie wymaga fizycznego bindingu akcesorium.");
  }

  const snapshot = await getCraftAccessorySnapshot();
  const accessory = snapshot.accessories.find((item) => item.id === accessoryId);
  if (!accessory) throw new Error("Wybrane fizyczne akcesorium nie istnieje.");
  if (accessory.kind !== SLOT_KINDS[slot]) {
    throw new Error(`Rodzaj fizycznego akcesorium nie odpowiada slotowi ${slot}.`);
  }

  const mounting = snapshot.mountingProfiles.find((item) => item.id === mountingProfileId);
  if (!mounting) throw new Error("Wybrany profil mocowania nie istnieje.");
  if (mounting.accessoryId !== accessoryId) {
    throw new Error("Profil mocowania należy do innego fizycznego akcesorium.");
  }
  if (mounting.bagFamily !== bagFamily) {
    throw new Error("Profil mocowania dotyczy innego fasonu niż binding kreatora.");
  }

  if (status === "VALIDATED") {
    const expectedStatus: CraftAccessoryStatus = "VALIDATED";
    if (accessory.status !== expectedStatus) {
      throw new Error("Binding można zatwierdzić dopiero dla fizycznie zatwierdzonego akcesorium.");
    }
    if (mounting.status !== expectedStatus) {
      throw new Error("Binding można zatwierdzić dopiero dla fizycznie zatwierdzonego profilu mocowania.");
    }
  }

  await ensureCraftBuilderAccessoryBindingsReady();
  const existing = await getProductDb()
    .prepare("SELECT id, created_at FROM craft_builder_accessory_bindings WHERE slot = ? AND builder_value = ? AND bag_family = ? LIMIT 1")
    .bind(slot, builderValue, bagFamily)
    .first<{ id: string; created_at: string }>();
  const id = existing?.id ?? crypto.randomUUID();
  const createdAt = existing?.created_at ?? new Date().toISOString();
  const updatedAt = new Date().toISOString();

  await getProductDb().prepare(`INSERT INTO craft_builder_accessory_bindings
    (id, slot, builder_value, bag_family, accessory_id, mounting_profile_id, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(slot, builder_value, bag_family) DO UPDATE SET
      accessory_id = excluded.accessory_id,
      mounting_profile_id = excluded.mounting_profile_id,
      status = excluded.status,
      updated_at = excluded.updated_at`)
    .bind(id, slot, builderValue, bagFamily, accessoryId, mountingProfileId, status, createdAt, updatedAt)
    .run();

  return (await getCraftBuilderAccessoryBindings()).find((item) =>
    item.slot === slot && item.builderValue === builderValue && item.bagFamily === bagFamily,
  )!;
}

export function expectedCraftAccessoryKind(slot: BuilderAccessorySlot) {
  return SLOT_KINDS[slot];
}
