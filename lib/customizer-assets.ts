import { getProductBucket, getProductDb } from "./products";

export const CUSTOMIZER_CATEGORIES = ["color", "stitch", "handles", "hardware", "strap", "accent"] as const;
export type CustomizerCategory = (typeof CUSTOMIZER_CATEGORIES)[number];

export type CustomizerAsset = {
  productId: string;
  category: CustomizerCategory;
  variant: string;
  imageUrl: string;
  updatedAt: string;
};

type CustomizerAssetRow = {
  product_id: string;
  category: string;
  variant: string;
  image_key: string;
  image_content_type: string;
  updated_at: string;
};

const createTableSql = `
  CREATE TABLE IF NOT EXISTS customizer_assets (
    id TEXT PRIMARY KEY NOT NULL,
    product_id TEXT NOT NULL,
    category TEXT NOT NULL,
    variant TEXT NOT NULL,
    image_key TEXT NOT NULL,
    image_content_type TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, category, variant)
  )
`;

const createIndexSql = `
  CREATE INDEX IF NOT EXISTS customizer_assets_product_idx
  ON customizer_assets (product_id, category, variant)
`;

let readyPromise: Promise<void> | null = null;

export function isCustomizerCategory(value: string): value is CustomizerCategory {
  return (CUSTOMIZER_CATEGORIES as readonly string[]).includes(value);
}

export function isCustomizerVariant(value: string) {
  return /^[a-z0-9][a-z0-9-]{0,79}$/.test(value);
}

export function isCustomizerProductId(value: string) {
  return /^[a-zA-Z0-9-]{1,80}$/.test(value);
}

export async function ensureCustomizerAssetsReady() {
  readyPromise ??= getProductDb().batch([
    getProductDb().prepare(createTableSql),
    getProductDb().prepare(createIndexSql),
  ]).then(() => undefined);
  try {
    await readyPromise;
  } catch (error) {
    readyPromise = null;
    throw error;
  }
}

function publicImageUrl(row: CustomizerAssetRow) {
  const params = new URLSearchParams({
    productId: row.product_id,
    category: row.category,
    variant: row.variant,
    v: row.updated_at,
  });
  return `/api/customizer-image?${params.toString()}`;
}

function toAsset(row: CustomizerAssetRow): CustomizerAsset {
  return {
    productId: row.product_id,
    category: row.category as CustomizerCategory,
    variant: row.variant,
    imageUrl: publicImageUrl(row),
    updatedAt: row.updated_at,
  };
}

export async function listCustomizerAssets(productId: string) {
  await ensureCustomizerAssetsReady();
  const result = await getProductDb()
    .prepare(`SELECT product_id, category, variant, image_key, image_content_type, updated_at
      FROM customizer_assets WHERE product_id = ? ORDER BY category, variant`)
    .bind(productId)
    .all<CustomizerAssetRow>();
  return result.results.map(toAsset);
}

export async function getCustomizerAssetRecord(productId: string, category: CustomizerCategory, variant: string) {
  await ensureCustomizerAssetsReady();
  return getProductDb()
    .prepare(`SELECT product_id, category, variant, image_key, image_content_type, updated_at
      FROM customizer_assets WHERE product_id = ? AND category = ? AND variant = ? LIMIT 1`)
    .bind(productId, category, variant)
    .first<CustomizerAssetRow>();
}

export async function upsertCustomizerAsset(input: {
  productId: string;
  category: CustomizerCategory;
  variant: string;
  imageKey: string;
  imageContentType: string;
}) {
  await ensureCustomizerAssetsReady();
  const previous = await getCustomizerAssetRecord(input.productId, input.category, input.variant);
  const now = new Date().toISOString();
  const id = `${input.productId}:${input.category}:${input.variant}`;
  await getProductDb()
    .prepare(`INSERT INTO customizer_assets
      (id, product_id, category, variant, image_key, image_content_type, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(product_id, category, variant) DO UPDATE SET
        image_key = excluded.image_key,
        image_content_type = excluded.image_content_type,
        updated_at = excluded.updated_at`)
    .bind(id, input.productId, input.category, input.variant, input.imageKey, input.imageContentType, now)
    .run();
  return { previousImageKey: previous?.image_key ?? null };
}

export async function deleteCustomizerAsset(productId: string, category: CustomizerCategory, variant: string) {
  await ensureCustomizerAssetsReady();
  const previous = await getCustomizerAssetRecord(productId, category, variant);
  if (!previous) return { deleted: false, imageKey: null as string | null };
  await getProductDb()
    .prepare("DELETE FROM customizer_assets WHERE product_id = ? AND category = ? AND variant = ?")
    .bind(productId, category, variant)
    .run();
  return { deleted: true, imageKey: previous.image_key };
}

export { getProductBucket as getCustomizerBucket };
