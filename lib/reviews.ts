import { getRuntimeBindings } from "./runtime-env";

type ReviewRow = {
  id: string;
  author_name: string;
  content: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type ReviewRateLimitRow = {
  attempts: number;
  window_start: number;
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

const createReviewRateLimitsSql = `
  CREATE TABLE IF NOT EXISTS review_rate_limits (
    fingerprint TEXT PRIMARY KEY NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    window_start INTEGER NOT NULL
  )
`;

const REVIEW_WINDOW_SECONDS = 60 * 60;
const REVIEW_MAX_ATTEMPTS = 5;

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
    db.prepare(createReviewRateLimitsSql),
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

export async function consumeReviewSubmission(fingerprint: string) {
  await ensureReviewsReady();
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - REVIEW_WINDOW_SECONDS;
  const db = getReviewDb();

  await db
    .prepare(
      `INSERT INTO review_rate_limits (fingerprint, attempts, window_start)
       VALUES (?, 1, ?)
       ON CONFLICT(fingerprint) DO UPDATE SET
         attempts = CASE
           WHEN review_rate_limits.window_start <= ? THEN 1
           ELSE review_rate_limits.attempts + 1
         END,
         window_start = CASE
           WHEN review_rate_limits.window_start <= ? THEN excluded.window_start
           ELSE review_rate_limits.window_start
         END`,
    )
    .bind(fingerprint, now, cutoff, cutoff)
    .run();

  const row = await db
    .prepare(
      `SELECT attempts, window_start
       FROM review_rate_limits
       WHERE fingerprint = ?
       LIMIT 1`,
    )
    .bind(fingerprint)
    .first<ReviewRateLimitRow>();

  const attempts = row?.attempts ?? 1;
  const retryAfter = Math.max(
    1,
    (row?.window_start ?? now) + REVIEW_WINDOW_SECONDS - now,
  );

  return {
    allowed: attempts <= REVIEW_MAX_ATTEMPTS,
    remaining: Math.max(0, REVIEW_MAX_ATTEMPTS - attempts),
    retryAfter,
  };
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
