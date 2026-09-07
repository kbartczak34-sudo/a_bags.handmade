import { BUILDER_FAMILIES, type BuilderFamily } from "./bag-builder-settings";
import { getProductDb } from "./products";

export const CRAFT_ACCESSORY_KINDS = ["FLAP", "HANDLE", "STRAP", "HARDWARE", "ACCENT", "CLOSURE"] as const;
export type CraftAccessoryKind = (typeof CRAFT_ACCESSORY_KINDS)[number];
export const CRAFT_ACCESSORY_STATUSES = ["DRAFT", "MEASURED", "VALIDATED"] as const;
export type CraftAccessoryStatus = (typeof CRAFT_ACCESSORY_STATUSES)[number];

export type CraftAccessoryRecord = {
  id: string;
  sku: string;
  kind: CraftAccessoryKind;
  name: string;
  material: string;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  thicknessMm: number | null;
  massG: number | null;
  status: CraftAccessoryStatus;
  createdAt: string;
  updatedAt: string;
};

export type CraftMountingProfileRecord = {
  id: string;
  accessoryId: string;
  bagFamily: BuilderFamily;
  zone: string;
  mountingMethod: string;
  anchorCount: number;
  holeSpacingMm: number | null;
  minEdgeClearanceMm: number;
  requiresReinforcement: boolean;
  validatedLoadN: number | null;
  status: CraftAccessoryStatus;
  createdAt: string;
  updatedAt: string;
};

export type CraftAccessorySnapshot = {
  accessories: CraftAccessoryRecord[];
  mountingProfiles: CraftMountingProfileRecord[];
  readiness: {
    status: "NOT_VALIDATED" | "VALIDATED";
    accessoriesValidated: number;
    mountingsValidated: number;
    reasons: string[];
  };
};

type AccessoryRow = {
  id: string;
  sku: string;
  kind: CraftAccessoryKind;
  name: string;
  material: string;
  length_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  thickness_mm: number | null;
  mass_g: number | null;
  status: CraftAccessoryStatus;
  created_at: string;
  updated_at: string;
};

type MountingRow = {
  id: string;
  accessory_id: string;
  bag_family: BuilderFamily;
  zone: string;
  mounting_method: string;
  anchor_count: number;
  hole_spacing_mm: number | null;
  min_edge_clearance_mm: number;
  requires_reinforcement: number;
  validated_load_n: number | null;
  status: CraftAccessoryStatus;
  created_at: string;
  updated_at: string;
};

const createAccessoriesSql = `
  CREATE TABLE IF NOT EXISTS craft_accessories (
    id TEXT PRIMARY KEY NOT NULL,
    sku TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    material TEXT NOT NULL,
    length_mm REAL,
    width_mm REAL,
    height_mm REAL,
    thickness_mm REAL,
    mass_g REAL,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

const createMountingsSql = `
  CREATE TABLE IF NOT EXISTS craft_mounting_profiles (
    id TEXT PRIMARY KEY NOT NULL,
    accessory_id TEXT NOT NULL,
    bag_family TEXT NOT NULL,
    zone TEXT NOT NULL,
    mounting_method TEXT NOT NULL,
    anchor_count INTEGER NOT NULL,
    hole_spacing_mm REAL,
    min_edge_clearance_mm REAL NOT NULL,
    requires_reinforcement INTEGER NOT NULL DEFAULT 0,
    validated_load_n REAL,
    status TEXT NOT NULL DEFAULT 'MEASURED',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

let readyPromise: Promise<void> | null = null;

function text(value: unknown, field: string, max = 160) {
  if (typeof value !== "string") throw new Error(`Brak pola: ${field}.`);
  const result = value.trim();
  if (!result || result.length > max || /[\u0000-\u001f\u007f]/.test(result)) throw new Error(`Nieprawidłowe pole: ${field}.`);
  return result;
}

function positive(value: unknown, field: string, max = 1_000_000) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || number > max) throw new Error(`Nieprawidłowy pomiar: ${field}.`);
  return number;
}

function optionalPositive(value: unknown, field: string, max = 1_000_000) {
  if (value === null || value === undefined || value === "") return null;
  return positive(value, field, max);
}

function nonNegative(value: unknown, field: string, max = 1_000_000) {
  if (value === null || value === undefined || value === "") throw new Error(`Brak pomiaru: ${field}.`);
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > max) throw new Error(`Nieprawidłowy pomiar: ${field}.`);
  return number;
}

function integer(value: unknown, field: string, max = 1000) {
  const number = positive(value, field, max);
  if (!Number.isInteger(number)) throw new Error(`Pole ${field} musi być liczbą całkowitą.`);
  return number;
}

function enumValue<T extends string>(value: unknown, values: readonly T[], field: string): T {
  if (typeof value !== "string" || !(values as readonly string[]).includes(value)) throw new Error(`Nieprawidłowe pole: ${field}.`);
  return value as T;
}

function status(value: unknown, fallback: CraftAccessoryStatus): CraftAccessoryStatus {
  return value === "VALIDATED" ? "VALIDATED" : value === "MEASURED" ? "MEASURED" : fallback;
}

function mapAccessory(row: AccessoryRow): CraftAccessoryRecord {
  return {
    id: row.id,
    sku: row.sku,
    kind: row.kind,
    name: row.name,
    material: row.material,
    lengthMm: row.length_mm,
    widthMm: row.width_mm,
    heightMm: row.height_mm,
    thicknessMm: row.thickness_mm,
    massG: row.mass_g,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMounting(row: MountingRow): CraftMountingProfileRecord {
  return {
    id: row.id,
    accessoryId: row.accessory_id,
    bagFamily: row.bag_family,
    zone: row.zone,
    mountingMethod: row.mounting_method,
    anchorCount: row.anchor_count,
    holeSpacingMm: row.hole_spacing_mm,
    minEdgeClearanceMm: row.min_edge_clearance_mm,
    requiresReinforcement: row.requires_reinforcement === 1,
    validatedLoadN: row.validated_load_n,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function ensureCraftAccessoriesReady() {
  readyPromise ??= (async () => {
    const db = getProductDb();
    await db.prepare(createAccessoriesSql).run();
    await db.prepare(createMountingsSql).run();
  })();
  try {
    await readyPromise;
  } catch (error) {
    readyPromise = null;
    throw error;
  }
}

export async function getCraftAccessorySnapshot(): Promise<CraftAccessorySnapshot> {
  await ensureCraftAccessoriesReady();
  const db = getProductDb();
  const [accessoryResult, mountingResult] = await Promise.all([
    db.prepare("SELECT * FROM craft_accessories ORDER BY updated_at DESC").all<AccessoryRow>(),
    db.prepare("SELECT * FROM craft_mounting_profiles ORDER BY updated_at DESC").all<MountingRow>(),
  ]);
  const accessories = accessoryResult.results.map(mapAccessory);
  const mountingProfiles = mountingResult.results.map(mapMounting);
  const accessoriesValidated = accessories.filter((item) => item.status === "VALIDATED").length;
  const mountingsValidated = mountingProfiles.filter((item) => item.status === "VALIDATED").length;
  const reasons: string[] = [];
  if (!accessoriesValidated) reasons.push("Brak zatwierdzonego fizycznego profilu akcesorium.");
  if (!mountingsValidated) reasons.push("Brak zatwierdzonego profilu mocowania akcesorium.");
  return {
    accessories,
    mountingProfiles,
    readiness: {
      status: reasons.length ? "NOT_VALIDATED" : "VALIDATED",
      accessoriesValidated,
      mountingsValidated,
      reasons,
    },
  };
}

export async function createCraftAccessory(source: unknown) {
  const raw = typeof source === "object" && source ? source as Record<string, unknown> : {};
  const sku = text(raw.sku, "sku");
  const kind = enumValue(raw.kind, CRAFT_ACCESSORY_KINDS, "kind");
  const name = text(raw.name, "name");
  const material = text(raw.material, "material");
  const lengthMm = optionalPositive(raw.lengthMm, "lengthMm");
  const widthMm = optionalPositive(raw.widthMm, "widthMm");
  const heightMm = optionalPositive(raw.heightMm, "heightMm");
  const thicknessMm = optionalPositive(raw.thicknessMm, "thicknessMm");
  const massG = optionalPositive(raw.massG, "massG", 1_000_000);
  const nextStatus = status(raw.status, "DRAFT");
  const measuredDimensions = [lengthMm, widthMm, heightMm, thicknessMm].filter((value) => value !== null).length;
  if (nextStatus === "VALIDATED" && (massG === null || measuredDimensions < 2)) {
    throw new Error("Akcesorium można zatwierdzić dopiero po zmierzeniu masy i co najmniej dwóch rzeczywistych wymiarów liniowych.");
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await ensureCraftAccessoriesReady();
  await getProductDb().prepare(`INSERT INTO craft_accessories
    (id, sku, kind, name, material, length_mm, width_mm, height_mm, thickness_mm, mass_g, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, sku, kind, name, material, lengthMm, widthMm, heightMm, thicknessMm, massG, nextStatus, now, now)
    .run();
  return (await getCraftAccessorySnapshot()).accessories.find((item) => item.id === id)!;
}

export async function createCraftMountingProfile(source: unknown) {
  const raw = typeof source === "object" && source ? source as Record<string, unknown> : {};
  const accessoryId = text(raw.accessoryId, "accessoryId");
  const bagFamily = enumValue(raw.bagFamily, BUILDER_FAMILIES, "bagFamily");
  const zone = text(raw.zone, "zone");
  const mountingMethod = text(raw.mountingMethod, "mountingMethod");
  const anchorCount = integer(raw.anchorCount, "anchorCount");
  const holeSpacingMm = optionalPositive(raw.holeSpacingMm, "holeSpacingMm");
  const minEdgeClearanceMm = nonNegative(raw.minEdgeClearanceMm, "minEdgeClearanceMm");
  const requiresReinforcement = raw.requiresReinforcement === true;
  const validatedLoadN = optionalPositive(raw.validatedLoadN, "validatedLoadN", 10_000_000);
  const nextStatus = status(raw.status, "MEASURED");

  await ensureCraftAccessoriesReady();
  const accessory = await getProductDb()
    .prepare("SELECT id, kind, status FROM craft_accessories WHERE id = ? LIMIT 1")
    .bind(accessoryId)
    .first<{ id: string; kind: CraftAccessoryKind; status: CraftAccessoryStatus }>();
  if (!accessory) throw new Error("Wybrane akcesorium nie istnieje.");
  if (nextStatus === "VALIDATED" && accessory.status !== "VALIDATED") {
    throw new Error("Mocowanie można zatwierdzić dopiero dla zatwierdzonego fizycznie akcesorium.");
  }
  if (nextStatus === "VALIDATED" && (accessory.kind === "HANDLE" || accessory.kind === "STRAP") && validatedLoadN === null) {
    throw new Error("Mocowanie uchwytu lub paska wymaga zmierzonej nośności przed zatwierdzeniem.");
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await getProductDb().prepare(`INSERT INTO craft_mounting_profiles
    (id, accessory_id, bag_family, zone, mounting_method, anchor_count, hole_spacing_mm, min_edge_clearance_mm, requires_reinforcement, validated_load_n, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, accessoryId, bagFamily, zone, mountingMethod, anchorCount, holeSpacingMm, minEdgeClearanceMm, requiresReinforcement ? 1 : 0, validatedLoadN, nextStatus, now, now)
    .run();
  return (await getCraftAccessorySnapshot()).mountingProfiles.find((item) => item.id === id)!;
}
