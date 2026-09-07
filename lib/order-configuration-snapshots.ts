import type Stripe from "stripe";
import {
  createConfigurationHash,
  toProductConfigurationV1,
  type ProductConfigurationV1,
} from "./configurator-resolver";
import { getRuntimeBindings } from "./runtime-env";

export type OrderConfigurationSnapshot = {
  sessionId: string;
  configurationHash: string;
  projectCode: string | null;
  catalogId: string | null;
  photoTrue: boolean;
  configuration: ProductConfigurationV1;
  amountTotal: number | null;
  currency: string | null;
  createdAt: string;
};

type SnapshotRow = {
  session_id: string;
  configuration_hash: string;
  project_code: string | null;
  catalog_id: string | null;
  photo_true: number;
  config_json: string;
  amount_total: number | null;
  currency: string | null;
  created_at: string;
};

const CREATE_SNAPSHOTS_SQL = `
  CREATE TABLE IF NOT EXISTS order_configuration_snapshots (
    session_id TEXT PRIMARY KEY NOT NULL,
    configuration_hash TEXT NOT NULL,
    project_code TEXT,
    catalog_id TEXT,
    photo_true INTEGER NOT NULL DEFAULT 0,
    config_json TEXT NOT NULL,
    amount_total INTEGER,
    currency TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

const CREATE_HASH_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS order_configuration_snapshots_hash_idx
  ON order_configuration_snapshots (configuration_hash)
`;

let readyPromise: Promise<void> | null = null;

function getDb() {
  const db = getRuntimeBindings().DB;
  if (!db) throw new Error("Brak połączenia z bazą snapshotów zamówień.");
  return db;
}

async function ensureReady() {
  readyPromise ??= getDb().batch([
    getDb().prepare(CREATE_SNAPSHOTS_SQL),
    getDb().prepare(CREATE_HASH_INDEX_SQL),
  ]).then(() => undefined);

  try {
    await readyPromise;
  } catch (error) {
    readyPromise = null;
    throw error;
  }
}

function paid(session: Stripe.Checkout.Session) {
  return session.payment_status === "paid" || session.payment_status === "no_payment_required";
}

function normalizedProjectCode(value: string | undefined) {
  if (!value) return null;
  const code = value.trim().toUpperCase();
  return /^AB-[A-Z0-9]{7}$/.test(code) ? code : null;
}

function normalizedCatalogId(value: string | undefined) {
  if (!value) return null;
  const id = value.trim();
  return /^[a-zA-Z0-9-]{1,80}$/.test(id) ? id : null;
}

function toSnapshot(row: SnapshotRow): OrderConfigurationSnapshot {
  return {
    sessionId: row.session_id,
    configurationHash: row.configuration_hash,
    projectCode: row.project_code,
    catalogId: row.catalog_id,
    photoTrue: Boolean(row.photo_true),
    configuration: JSON.parse(row.config_json) as ProductConfigurationV1,
    amountTotal: row.amount_total,
    currency: row.currency,
    createdAt: row.created_at,
  };
}

export async function recordPaidOrderConfigurationSnapshot(session: Stripe.Checkout.Session) {
  if (!paid(session)) return { created: false, reason: "not_paid" as const };

  const metadata = session.metadata;
  const storedHash = metadata?.builder_configuration_hash?.trim().toLowerCase();
  const rawConfig = metadata?.builder_project_config;

  // Orders from before resolver hashing remain valid; do not invent a historical hash for them.
  if (!storedHash || !rawConfig) return { created: false, reason: "legacy_session" as const };
  if (!/^[a-f0-9]{64}$/.test(storedHash)) {
    throw new Error("Nieprawidłowy hash konfiguracji w metadanych płatności.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawConfig);
  } catch {
    throw new Error("Nieprawidłowy zapis konfiguracji w metadanych płatności.");
  }

  const configuration = toProductConfigurationV1(parsed);
  const calculatedHash = await createConfigurationHash(configuration);
  if (calculatedHash !== storedHash) {
    throw new Error("Hash konfiguracji nie odpowiada zapisanej konfiguracji płatności.");
  }

  await ensureReady();
  const now = new Date().toISOString();
  await getDb()
    .prepare(
      `INSERT OR IGNORE INTO order_configuration_snapshots (
         session_id, configuration_hash, project_code, catalog_id,
         photo_true, config_json, amount_total, currency, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      session.id,
      storedHash,
      normalizedProjectCode(metadata?.builder_project_code),
      normalizedCatalogId(metadata?.builder_catalog_id),
      metadata?.builder_photo_true === "true" ? 1 : 0,
      JSON.stringify(configuration),
      session.amount_total ?? null,
      session.currency ?? null,
      now,
    )
    .run();

  return { created: true, configurationHash: storedHash } as const;
}

export async function getOrderConfigurationSnapshot(sessionId: string) {
  const id = sessionId.trim();
  if (!id) return null;
  await ensureReady();

  const row = await getDb()
    .prepare(
      `SELECT session_id, configuration_hash, project_code, catalog_id,
              photo_true, config_json, amount_total, currency, created_at
       FROM order_configuration_snapshots
       WHERE session_id = ?
       LIMIT 1`,
    )
    .bind(id)
    .first<SnapshotRow>();

  return row ? toSnapshot(row) : null;
}
