import type { CatalogProduct } from "./catalog";
import { grossFromNetCents, VAT_RATE_PERCENT } from "./catalog";
import { getRuntimeBindings } from "./runtime-env";

type ProductRow = {
  id: string;
  name: string;
  detail: string;
  price_cents: number;
  tone: string;
  sort_order: number;
  is_visible: number;
  image_key: string | null;
  image_content_type: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminProduct = {
  id: string;
  name: string;
  detail: string;
  priceCents: number;
  tone: string;
  sortOrder: number;
  isVisible: boolean;
  imageUrl: string | null;
  updatedAt: string;
};

export type ProductInput = {
  name: string;
  detail: string;
  priceCents: number;
  sortOrder: number;
  isVisible: boolean;
};

const createProductsSql = `
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    price_cents INTEGER NOT NULL,
    tone TEXT NOT NULL DEFAULT 'product-rose',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_visible INTEGER NOT NULL DEFAULT 1,
    image_key TEXT,
    image_content_type TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

const createSettingsSql = `
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  )
`;

const createProductsSortIndexSql = `
  CREATE INDEX IF NOT EXISTS products_sort_order_idx
  ON products (sort_order, created_at)
`;

const seedProducts = [
  {
    id: "lila",
    name: "Torebka Lila",
    detail: "Fiolet · ręcznie pleciona",
    priceCents: 18_900,
    tone: "product-lilac",
    sortOrder: 10,
  },
  {
    id: "rose",
    name: "Torebka Rose",
    detail: "Pudrowy róż · z frędzlami",
    priceCents: 21_900,
    tone: "product-rose",
    sortOrder: 20,
  },
  {
    id: "natural",
    name: "Torebka Natural",
    detail: "Piaskowy beż · klasyczna",
    priceCents: 19_900,
    tone: "product-sand",
    sortOrder: 30,
  },
];

let readyPromise: Promise<void> | null = null;

export function getProductDb() {
  const db = getRuntimeBindings().DB;
  if (!db) throw new Error("Brak połączenia z bazą produktów.");
  return db;
}

export function getProductBucket() {
  const bucket = getRuntimeBindings().BUCKET;
  if (!bucket) throw new Error("Brak magazynu zdjęć produktów.");
  return bucket;
}

async function initializeCatalog() {
  const db = getProductDb();
  await db.batch([
    db.prepare(createProductsSql),
    db.prepare(createSettingsSql),
    db.prepare(createProductsSortIndexSql),
  ]);

  const seeded = await db
    .prepare("SELECT value FROM app_settings WHERE key = ? LIMIT 1")
    .bind("catalog_seeded")
    .first<{ value: string }>();

  if (seeded) return;

  const statements = seedProducts.map((product) =>
    db
      .prepare(
        `INSERT OR IGNORE INTO products
          (id, name, detail, price_cents, tone, sort_order, is_visible)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
      )
      .bind(
        product.id,
        product.name,
        product.detail,
        product.priceCents,
        product.tone,
        product.sortOrder,
      ),
  );
  statements.push(
    db
      .prepare(
        "INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)",
      )
      .bind("catalog_seeded", new Date().toISOString()),
  );
  await db.batch(statements);
}

export async function ensureCatalogReady() {
  readyPromise ??= initializeCatalog();
  try {
    await readyPromise;
  } catch (error) {
    readyPromise = null;
    throw error;
  }
}

function productImageUrl(row: ProductRow) {
  if (!row.image_key) return null;
  return `/api/product-image?id=${encodeURIComponent(row.id)}&v=${encodeURIComponent(row.updated_at)}`;
}

function toAdminProduct(row: ProductRow): AdminProduct {
  return {
    id: row.id,
    name: row.name,
    detail: row.detail,
    priceCents: row.price_cents,
    tone: row.tone,
    sortOrder: row.sort_order,
    isVisible: Boolean(row.is_visible),
    imageUrl: productImageUrl(row),
    updatedAt: row.updated_at,
  };
}

function toCatalogProduct(row: ProductRow, index: number): CatalogProduct {
  const baseAmount = row.price_cents;
  const vatMode = getRuntimeBindings().LEGAL_VAT_MODE;
  const vatActive = vatMode === "active_23";
  const unitAmount = vatActive ? grossFromNetCents(baseAmount) : baseAmount;

  return {
    id: row.id,
    number: String(index + 1).padStart(2, "0"),
    name: row.name,
    detail: row.detail,
    tone: row.tone,
    price: unitAmount / 100,
    unitAmount,
    netAmount: baseAmount,
    vatAmount: vatActive ? unitAmount - baseAmount : 0,
    vatRate: vatActive ? VAT_RATE_PERCENT : 0,
    imageUrl: productImageUrl(row),
    isVisible: Boolean(row.is_visible),
    sortOrder: row.sort_order,
  };
}

export async function listAdminProducts() {
  await ensureCatalogReady();
  const result = await getProductDb()
    .prepare(
      `SELECT id, name, detail, price_cents, tone, sort_order, is_visible,
              image_key, image_content_type, created_at, updated_at
       FROM products
       ORDER BY sort_order ASC, created_at ASC`,
    )
    .all<ProductRow>();
  return result.results.map(toAdminProduct);
}

export async function listStorefrontProducts() {
  await ensureCatalogReady();
  const result = await getProductDb()
    .prepare(
      `SELECT id, name, detail, price_cents, tone, sort_order, is_visible,
              image_key, image_content_type, created_at, updated_at
       FROM products
       WHERE is_visible = 1
       ORDER BY sort_order ASC, created_at ASC`,
    )
    .all<ProductRow>();
  return result.results.map(toCatalogProduct);
}

export async function findVisibleProductsByIds(
  ids: string[],
): Promise<Map<string, CatalogProduct>> {
  if (ids.length === 0) return new Map<string, CatalogProduct>();
  await ensureCatalogReady();
  const placeholders = ids.map(() => "?").join(", ");
  const result = await getProductDb()
    .prepare(
      `SELECT id, name, detail, price_cents, tone, sort_order, is_visible,
              image_key, image_content_type, created_at, updated_at
       FROM products
       WHERE is_visible = 1 AND id IN (${placeholders})`,
    )
    .bind(...ids)
    .all<ProductRow>();
  return new Map<string, CatalogProduct>(
    result.results.map(
      (row, index): [string, CatalogProduct] => [
        row.id,
        toCatalogProduct(row, index),
      ],
    ),
  );
}

export async function getProductImageRecord(id: string) {
  await ensureCatalogReady();
  return getProductDb()
    .prepare(
      `SELECT id, image_key, image_content_type
       FROM products WHERE id = ? LIMIT 1`,
    )
    .bind(id)
    .first<Pick<ProductRow, "id" | "image_key" | "image_content_type">>();
}

export async function createProduct(
  input: ProductInput,
  image: { key: string; contentType: string } | null,
  requestedId?: string,
) {
  await ensureCatalogReady();
  const id = requestedId ?? crypto.randomUUID();
  const toneOptions = ["product-rose", "product-lilac", "product-sand"];
  const tone = toneOptions[Math.abs(input.sortOrder) % toneOptions.length];
  await getProductDb()
    .prepare(
      `INSERT INTO products
        (id, name, detail, price_cents, tone, sort_order, is_visible,
         image_key, image_content_type, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.name,
      input.detail,
      input.priceCents,
      tone,
      input.sortOrder,
      input.isVisible ? 1 : 0,
      image?.key ?? null,
      image?.contentType ?? null,
      new Date().toISOString(),
    )
    .run();
  return id;
}

export async function updateProduct(
  id: string,
  input: ProductInput,
  image: { key: string; contentType: string } | null | undefined,
) {
  await ensureCatalogReady();
  const db = getProductDb();
  const existing = await db
    .prepare("SELECT image_key FROM products WHERE id = ? LIMIT 1")
    .bind(id)
    .first<{ image_key: string | null }>();
  if (!existing) return { updated: false, oldImageKey: null };

  const nextImageKey = image === undefined ? existing.image_key : image?.key ?? null;
  const nextImageType = image === undefined ? undefined : image?.contentType ?? null;
  const updatedAt = new Date().toISOString();

  if (nextImageType === undefined) {
    await db
      .prepare(
        `UPDATE products
         SET name = ?, detail = ?, price_cents = ?, sort_order = ?,
             is_visible = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        input.name,
        input.detail,
        input.priceCents,
        input.sortOrder,
        input.isVisible ? 1 : 0,
        updatedAt,
        id,
      )
      .run();
  } else {
    await db
      .prepare(
        `UPDATE products
         SET name = ?, detail = ?, price_cents = ?, sort_order = ?,
             is_visible = ?, image_key = ?, image_content_type = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        input.name,
        input.detail,
        input.priceCents,
        input.sortOrder,
        input.isVisible ? 1 : 0,
        nextImageKey,
        nextImageType,
        updatedAt,
        id,
      )
      .run();
  }

  return { updated: true, oldImageKey: existing.image_key };
}

export async function deleteProduct(id: string) {
  await ensureCatalogReady();
  const db = getProductDb();
  const existing = await db
    .prepare("SELECT image_key FROM products WHERE id = ? LIMIT 1")
    .bind(id)
    .first<{ image_key: string | null }>();
  if (!existing) return { deleted: false, imageKey: null };
  await db.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
  return { deleted: true, imageKey: existing.image_key };
}
