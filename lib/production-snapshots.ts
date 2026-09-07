import { createConfigurationHash } from "./configurator-resolver";
import { getProductDb } from "./products";

export const PRODUCTION_SNAPSHOT_SCHEMA_VERSION = 1 as const;

type ProductionSnapshotRow = {
  id: string;
  package_hash: string;
  package_json: string;
  created_at: string;
};

export type ProductionSnapshot = {
  id: string;
  schemaVersion: typeof PRODUCTION_SNAPSHOT_SCHEMA_VERSION;
  packageHash: string;
  package: unknown;
  createdAt: string;
};

const createTableSql = `
  CREATE TABLE IF NOT EXISTS production_snapshots (
    id TEXT PRIMARY KEY NOT NULL,
    package_hash TEXT NOT NULL UNIQUE,
    package_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

let readyPromise: Promise<void> | null = null;

async function ensureReady() {
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

function mapSnapshot(row: ProductionSnapshotRow): ProductionSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(row.package_json);
  } catch {
    throw new Error("Nieprawidłowy zapis Production Snapshot.");
  }
  return {
    id: row.id,
    schemaVersion: PRODUCTION_SNAPSHOT_SCHEMA_VERSION,
    packageHash: row.package_hash,
    package: parsed,
    createdAt: row.created_at,
  };
}

export async function persistProductionSnapshot(productionPackage: unknown) {
  if (!productionPackage || typeof productionPackage !== "object") {
    throw new Error("Production Snapshot wymaga kompletnego pakietu produkcyjnego.");
  }

  await ensureReady();
  const packageHash = await createConfigurationHash(productionPackage);
  const packageJson = JSON.stringify(productionPackage);
  const id = `ps_${crypto.randomUUID()}`;

  await getProductDb()
    .prepare(`INSERT INTO production_snapshots (id, package_hash, package_json)
      VALUES (?, ?, ?)
      ON CONFLICT(package_hash) DO NOTHING`)
    .bind(id, packageHash, packageJson)
    .run();

  const row = await getProductDb()
    .prepare("SELECT * FROM production_snapshots WHERE package_hash = ? LIMIT 1")
    .bind(packageHash)
    .first<ProductionSnapshotRow>();
  if (!row) throw new Error("Nie udało się utrwalić Production Snapshot.");

  return mapSnapshot(row);
}

export async function getProductionSnapshot(id: string) {
  await ensureReady();
  const row = await getProductDb()
    .prepare("SELECT * FROM production_snapshots WHERE id = ? LIMIT 1")
    .bind(id)
    .first<ProductionSnapshotRow>();
  return row ? mapSnapshot(row) : null;
}
