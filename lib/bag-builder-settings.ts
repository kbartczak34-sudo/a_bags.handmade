import { getProductDb } from "./products";

export const BUILDER_FAMILIES = ["tote", "round", "bucket", "mini"] as const;
export const BUILDER_STITCHES = ["classic", "herringbone", "basket", "shell"] as const;
export const BUILDER_FLAPS = ["none", "crochet", "leather-black", "leather-cognac", "suede-burgundy"] as const;
export const BUILDER_HANDLES = ["none", "wood-light", "wood-dark", "crochet"] as const;
export const BUILDER_STRAPS = ["none", "leather", "woven", "chain"] as const;
export const BUILDER_HARDWARE = ["gold", "silver", "black"] as const;
export const BUILDER_ACCENTS = ["none", "tassel", "scarf", "charm"] as const;

export type BuilderFamily = (typeof BUILDER_FAMILIES)[number];
export type BuilderStitch = (typeof BUILDER_STITCHES)[number];
export type BuilderFlap = (typeof BUILDER_FLAPS)[number];
export type BuilderHandles = (typeof BUILDER_HANDLES)[number];
export type BuilderStrap = (typeof BUILDER_STRAPS)[number];
export type BuilderHardware = (typeof BUILDER_HARDWARE)[number];
export type BuilderAccent = (typeof BUILDER_ACCENTS)[number];

type PriceMap<T extends string> = Record<T, number>;
type Compatibility<T extends string> = Record<BuilderFamily, T[]>;

export type BagBuilderSettings = {
  pricingEnabled: boolean;
  currency: "PLN";
  familyBaseCents: Record<BuilderFamily, number | null>;
  stitchCents: PriceMap<BuilderStitch>;
  flapCents: PriceMap<BuilderFlap>;
  handlesCents: PriceMap<BuilderHandles>;
  strapCents: PriceMap<BuilderStrap>;
  hardwareCents: PriceMap<BuilderHardware>;
  accentCents: PriceMap<BuilderAccent>;
  compatibility: {
    handles: Compatibility<BuilderHandles>;
    straps: Compatibility<BuilderStrap>;
    flaps: Compatibility<BuilderFlap>;
  };
  updatedAt: string | null;
};

const ALL_FLAPS = [...BUILDER_FLAPS];
const ALL_STRAPS = [...BUILDER_STRAPS];

export const DEFAULT_BAG_BUILDER_SETTINGS: BagBuilderSettings = {
  pricingEnabled: false,
  currency: "PLN",
  familyBaseCents: { tote: null, round: null, bucket: null, mini: null },
  stitchCents: { classic: 0, herringbone: 0, basket: 0, shell: 0 },
  flapCents: { none: 0, crochet: 0, "leather-black": 0, "leather-cognac": 0, "suede-burgundy": 0 },
  handlesCents: { none: 0, "wood-light": 0, "wood-dark": 0, crochet: 0 },
  strapCents: { none: 0, leather: 0, woven: 0, chain: 0 },
  hardwareCents: { gold: 0, silver: 0, black: 0 },
  accentCents: { none: 0, tassel: 0, scarf: 0, charm: 0 },
  compatibility: {
    handles: {
      tote: [...BUILDER_HANDLES],
      round: ["none", "crochet"],
      bucket: [...BUILDER_HANDLES],
      mini: ["none", "crochet"],
    },
    straps: {
      tote: [...ALL_STRAPS],
      round: [...ALL_STRAPS],
      bucket: [...ALL_STRAPS],
      mini: [...ALL_STRAPS],
    },
    flaps: {
      tote: [...ALL_FLAPS],
      round: [...ALL_FLAPS],
      bucket: [...ALL_FLAPS],
      mini: [...ALL_FLAPS],
    },
  },
  updatedAt: null,
};

const createTableSql = `
  CREATE TABLE IF NOT EXISTS bag_builder_settings (
    id TEXT PRIMARY KEY NOT NULL,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

let readyPromise: Promise<void> | null = null;

function cents(value: unknown, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(10_000_000, Math.round(number)));
}

function optionalCents(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return cents(value);
}

function allowed<T extends string>(value: unknown, valid: readonly T[], fallback: T[]) {
  if (!Array.isArray(value)) return [...fallback];
  const validSet = new Set<string>(valid);
  const next = value.filter((item): item is T => typeof item === "string" && validSet.has(item));
  return next.length ? Array.from(new Set(next)) : [...fallback];
}

function priceRecord<T extends string>(source: unknown, keys: readonly T[], fallback: Record<T, number>) {
  const record = typeof source === "object" && source ? source as Record<string, unknown> : {};
  return Object.fromEntries(keys.map((key) => [key, cents(record[key], fallback[key])])) as Record<T, number>;
}

export function normalizeBagBuilderSettings(source: unknown): BagBuilderSettings {
  const raw = typeof source === "object" && source ? source as Record<string, unknown> : {};
  const familyRaw = typeof raw.familyBaseCents === "object" && raw.familyBaseCents ? raw.familyBaseCents as Record<string, unknown> : {};
  const compatibilityRaw = typeof raw.compatibility === "object" && raw.compatibility ? raw.compatibility as Record<string, unknown> : {};
  const handlesRaw = typeof compatibilityRaw.handles === "object" && compatibilityRaw.handles ? compatibilityRaw.handles as Record<string, unknown> : {};
  const strapsRaw = typeof compatibilityRaw.straps === "object" && compatibilityRaw.straps ? compatibilityRaw.straps as Record<string, unknown> : {};
  const flapsRaw = typeof compatibilityRaw.flaps === "object" && compatibilityRaw.flaps ? compatibilityRaw.flaps as Record<string, unknown> : {};

  return {
    pricingEnabled: raw.pricingEnabled === true,
    currency: "PLN",
    familyBaseCents: {
      tote: optionalCents(familyRaw.tote),
      round: optionalCents(familyRaw.round),
      bucket: optionalCents(familyRaw.bucket),
      mini: optionalCents(familyRaw.mini),
    },
    stitchCents: priceRecord(raw.stitchCents, BUILDER_STITCHES, DEFAULT_BAG_BUILDER_SETTINGS.stitchCents),
    flapCents: priceRecord(raw.flapCents, BUILDER_FLAPS, DEFAULT_BAG_BUILDER_SETTINGS.flapCents),
    handlesCents: priceRecord(raw.handlesCents, BUILDER_HANDLES, DEFAULT_BAG_BUILDER_SETTINGS.handlesCents),
    strapCents: priceRecord(raw.strapCents, BUILDER_STRAPS, DEFAULT_BAG_BUILDER_SETTINGS.strapCents),
    hardwareCents: priceRecord(raw.hardwareCents, BUILDER_HARDWARE, DEFAULT_BAG_BUILDER_SETTINGS.hardwareCents),
    accentCents: priceRecord(raw.accentCents, BUILDER_ACCENTS, DEFAULT_BAG_BUILDER_SETTINGS.accentCents),
    compatibility: {
      handles: Object.fromEntries(BUILDER_FAMILIES.map((family) => [family, allowed(handlesRaw[family], BUILDER_HANDLES, DEFAULT_BAG_BUILDER_SETTINGS.compatibility.handles[family])])) as Compatibility<BuilderHandles>,
      straps: Object.fromEntries(BUILDER_FAMILIES.map((family) => [family, allowed(strapsRaw[family], BUILDER_STRAPS, DEFAULT_BAG_BUILDER_SETTINGS.compatibility.straps[family])])) as Compatibility<BuilderStrap>,
      flaps: Object.fromEntries(BUILDER_FAMILIES.map((family) => [family, allowed(flapsRaw[family], BUILDER_FLAPS, DEFAULT_BAG_BUILDER_SETTINGS.compatibility.flaps[family])])) as Compatibility<BuilderFlap>,
    },
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
  };
}

export async function ensureBagBuilderSettingsReady() {
  readyPromise ??= getProductDb().prepare(createTableSql).run().then(() => undefined);
  try {
    await readyPromise;
  } catch (error) {
    readyPromise = null;
    throw error;
  }
}

export async function getBagBuilderSettings(): Promise<BagBuilderSettings> {
  await ensureBagBuilderSettingsReady();
  const row = await getProductDb()
    .prepare("SELECT payload, updated_at FROM bag_builder_settings WHERE id = 'default' LIMIT 1")
    .first<{ payload: string; updated_at: string }>();
  if (!row) return DEFAULT_BAG_BUILDER_SETTINGS;
  try {
    const normalized = normalizeBagBuilderSettings(JSON.parse(row.payload));
    return { ...normalized, updatedAt: row.updated_at };
  } catch {
    return DEFAULT_BAG_BUILDER_SETTINGS;
  }
}

export async function saveBagBuilderSettings(source: unknown) {
  await ensureBagBuilderSettingsReady();
  const settings = normalizeBagBuilderSettings(source);
  const now = new Date().toISOString();
  const payload = JSON.stringify({ ...settings, updatedAt: undefined });
  await getProductDb()
    .prepare(`INSERT INTO bag_builder_settings (id, payload, updated_at) VALUES ('default', ?, ?)
      ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`)
    .bind(payload, now)
    .run();
  return { ...settings, updatedAt: now };
}
