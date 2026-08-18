import { getRuntimeBindings } from "./runtime-env";

type ReviewRow = {
  id: string;
  author_name: string;
  content: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type ReviewStatus = "pending" | "approved" | "rejected";

export type StorefrontReview = {
  id: string;
  authorName: string;
  content: string;
  createdAt: string;
};

export type AdminReview = StorefrontReview & {
  status: ReviewStatus;
  updatedAt: string;
};

const createReviewsSql = `
  CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY NOT NULL,
    author_name TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

const createReviewsStatusIndexSql = `
  CREATE INDEX IF NOT EXISTS reviews_status_created_at_idx
  ON reviews (status, created_at)
`;

let readyPromise: Promise<void> | null = null;

function getReviewDb() {
  const db = getRuntimeBindings().DB;
  if (!db) throw new Error("Brak połączenia z bazą opinii.");
  return db;
}

async function initializeReviews() {
  const db = getReviewDb();
  await db.batch([
    db.prepare(createReviewsSql),
    db.prepare(createReviewsStatusIndexSql),
  ]);
}

export async function ensureReviewsReady() {
  readyPromise ??= initializeReviews();
  try {
    await readyPromise;
  } catch (error) {
    readyPromise = null;
    throw error;
  }
}

function toStorefrontReview(row: ReviewRow): StorefrontReview {
  return {
    id: row.id,
    authorName: row.author_name,
    content: row.content,
    createdAt: row.created_at,
  };
}

function toAdminReview(row: ReviewRow): AdminReview {
  return {
    ...toStorefrontReview(row),
    status: row.status as ReviewStatus,
    updatedAt: row.updated_at,
  };
}

export async function listApprovedReviews(limit = 6) {
  await ensureReviewsReady();
  const safeLimit = Math.max(1, Math.min(12, Math.trunc(limit)));
  const result = await getReviewDb()
    .prepare(
      `SELECT id, author_name, content, status, created_at, updated_at
       FROM reviews
       WHERE status = 'approved'
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .bind(safeLimit)
    .all<ReviewRow>();
  return result.results.map(toStorefrontReview);
}

export async function createPendingReview(authorName: string, content: string) {
  await ensureReviewsReady();
  const id = crypto.randomUUID();
  await getReviewDb()
    .prepare(
      `INSERT INTO reviews (id, author_name, content, status)
       VALUES (?, ?, ?, 'pending')`,
    )
    .bind(id, authorName, content)
    .run();
  return id;
}

export async function listAdminReviews() {
  await ensureReviewsReady();
  const result = await getReviewDb()
    .prepare(
      `SELECT id, author_name, content, status, created_at, updated_at
       FROM reviews
       ORDER BY
         CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
         created_at DESC`,
    )
    .all<ReviewRow>();
  return result.results.map(toAdminReview);
}

export async function setReviewStatus(id: string, status: ReviewStatus) {
  await ensureReviewsReady();
  const result = await getReviewDb()
    .prepare(
      `UPDATE reviews
       SET status = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(status, new Date().toISOString(), id)
    .run() as { meta?: { changes?: number } };
  return Boolean(result.meta?.changes);
}

export async function deleteReview(id: string) {
  await ensureReviewsReady();
  const result = await getReviewDb()
    .prepare("DELETE FROM reviews WHERE id = ?")
    .bind(id)
    .run() as { meta?: { changes?: number } };
  return Boolean(result.meta?.changes);
}
