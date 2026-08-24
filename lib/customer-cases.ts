import { getRuntimeBindings } from "./runtime-env";

export type CustomerCaseType = "withdrawal" | "complaint";
export type CustomerCaseStatus = "new" | "in_review" | "responded" | "closed";

type CustomerCaseRow = {
  id: string;
  type: CustomerCaseType;
  order_reference: string;
  customer_name: string;
  email: string;
  product_name: string;
  description: string;
  requested_resolution: string;
  status: CustomerCaseStatus;
  response_due_at: string | null;
  response_note: string;
  responded_at: string | null;
  confirmation_email_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

type CustomerCaseRateLimitRow = {
  attempts: number;
  window_start: number;
};

export type NewCustomerCase = {
  type: CustomerCaseType;
  orderReference: string;
  customerName: string;
  email: string;
  productName: string;
  description: string;
  requestedResolution: string;
};

export type AdminCustomerCase = {
  id: string;
  type: CustomerCaseType;
  orderReference: string;
  customerName: string;
  email: string;
  productName: string;
  description: string;
  requestedResolution: string;
  status: CustomerCaseStatus;
  responseDueAt: string | null;
  responseNote: string;
  respondedAt: string | null;
  confirmationEmailSentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const createCasesSql = `
  CREATE TABLE IF NOT EXISTS customer_cases (
    id TEXT PRIMARY KEY NOT NULL,
    type TEXT NOT NULL,
    order_reference TEXT NOT NULL DEFAULT '',
    customer_name TEXT NOT NULL,
    email TEXT NOT NULL,
    product_name TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL,
    requested_resolution TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'new',
    response_due_at TEXT,
    response_note TEXT NOT NULL DEFAULT '',
    responded_at TEXT,
    confirmation_email_sent_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

const createCasesStatusIndexSql = `
  CREATE INDEX IF NOT EXISTS customer_cases_status_created_at_idx
  ON customer_cases (status, created_at)
`;

const createCasesDueIndexSql = `
  CREATE INDEX IF NOT EXISTS customer_cases_due_at_idx
  ON customer_cases (response_due_at, status)
`;

const createCaseRateLimitsSql = `
  CREATE TABLE IF NOT EXISTS customer_case_rate_limits (
    fingerprint TEXT PRIMARY KEY NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    window_start INTEGER NOT NULL
  )
`;

const CASE_WINDOW_SECONDS = 60 * 60;
const CASE_MAX_ATTEMPTS = 5;
const COMPLAINT_RESPONSE_DAYS = 14;

let readyPromise: Promise<void> | null = null;

function getCaseDb() {
  const db = getRuntimeBindings().DB;
  if (!db) throw new Error("Brak połączenia z bazą zgłoszeń klientów.");
  return db;
}

async function addColumn(sql: string) {
  try {
    await getCaseDb().prepare(sql).run();
  } catch {
    // Kolumna już istnieje.
  }
}

async function initializeCustomerCases() {
  const db = getCaseDb();
  await db.batch([
    db.prepare(createCasesSql),
    db.prepare(createCasesStatusIndexSql),
    db.prepare(createCasesDueIndexSql),
    db.prepare(createCaseRateLimitsSql),
  ]);
  await addColumn("ALTER TABLE customer_cases ADD COLUMN confirmation_email_sent_at TEXT");
}

export async function ensureCustomerCasesReady() {
  readyPromise ??= initializeCustomerCases();
  try {
    await readyPromise;
  } catch (error) {
    readyPromise = null;
    throw error;
  }
}

function toAdminCase(row: CustomerCaseRow): AdminCustomerCase {
  return {
    id: row.id,
    type: row.type,
    orderReference: row.order_reference,
    customerName: row.customer_name,
    email: row.email,
    productName: row.product_name,
    description: row.description,
    requestedResolution: row.requested_resolution,
    status: row.status,
    responseDueAt: row.response_due_at,
    responseNote: row.response_note,
    respondedAt: row.responded_at,
    confirmationEmailSentAt: row.confirmation_email_sent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function consumeCustomerCaseSubmission(fingerprint: string) {
  await ensureCustomerCasesReady();
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - CASE_WINDOW_SECONDS;
  const db = getCaseDb();

  await db
    .prepare(
      `INSERT INTO customer_case_rate_limits (fingerprint, attempts, window_start)
       VALUES (?, 1, ?)
       ON CONFLICT(fingerprint) DO UPDATE SET
         attempts = CASE
           WHEN customer_case_rate_limits.window_start <= ? THEN 1
           ELSE customer_case_rate_limits.attempts + 1
         END,
         window_start = CASE
           WHEN customer_case_rate_limits.window_start <= ? THEN excluded.window_start
           ELSE customer_case_rate_limits.window_start
         END`,
    )
    .bind(fingerprint, now, cutoff, cutoff)
    .run();

  const row = await db
    .prepare(
      `SELECT attempts, window_start
       FROM customer_case_rate_limits
       WHERE fingerprint = ?
       LIMIT 1`,
    )
    .bind(fingerprint)
    .first<CustomerCaseRateLimitRow>();

  const attempts = row?.attempts ?? 1;
  const retryAfter = Math.max(
    1,
    (row?.window_start ?? now) + CASE_WINDOW_SECONDS - now,
  );

  return {
    allowed: attempts <= CASE_MAX_ATTEMPTS,
    remaining: Math.max(0, CASE_MAX_ATTEMPTS - attempts),
    retryAfter,
  };
}

export async function createCustomerCase(input: NewCustomerCase) {
  await ensureCustomerCasesReady();
  const id = `AB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const now = new Date();
  const createdAt = now.toISOString();
  const responseDueAt =
    input.type === "complaint"
      ? new Date(
          now.getTime() + COMPLAINT_RESPONSE_DAYS * 24 * 60 * 60 * 1000,
        ).toISOString()
      : null;

  await getCaseDb()
    .prepare(
      `INSERT INTO customer_cases
        (id, type, order_reference, customer_name, email, product_name,
         description, requested_resolution, status, response_due_at,
         response_note, responded_at, confirmation_email_sent_at,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, '', NULL, NULL, ?, ?)`,
    )
    .bind(
      id,
      input.type,
      input.orderReference,
      input.customerName,
      input.email,
      input.productName,
      input.description,
      input.requestedResolution,
      responseDueAt,
      createdAt,
      createdAt,
    )
    .run();

  return { id, createdAt, responseDueAt };
}

export async function markCustomerCaseConfirmationSent(id: string) {
  await ensureCustomerCasesReady();
  const now = new Date().toISOString();
  await getCaseDb()
    .prepare(
      `UPDATE customer_cases
       SET confirmation_email_sent_at = COALESCE(confirmation_email_sent_at, ?),
           updated_at = ?
       WHERE id = ?`,
    )
    .bind(now, now, id)
    .run();
  return now;
}

export async function listCustomerCases(limit = 200) {
  await ensureCustomerCasesReady();
  const safeLimit = Math.max(1, Math.min(500, Math.trunc(limit)));
  const result = await getCaseDb()
    .prepare(
      `SELECT id, type, order_reference, customer_name, email, product_name,
              description, requested_resolution, status, response_due_at,
              response_note, responded_at, confirmation_email_sent_at,
              created_at, updated_at
       FROM customer_cases
       ORDER BY
         CASE status
           WHEN 'new' THEN 0
           WHEN 'in_review' THEN 1
           WHEN 'responded' THEN 2
           ELSE 3
         END,
         CASE WHEN response_due_at IS NULL THEN 1 ELSE 0 END,
         response_due_at ASC,
         created_at DESC
       LIMIT ?`,
    )
    .bind(safeLimit)
    .all<CustomerCaseRow>();
  return result.results.map(toAdminCase);
}

export async function updateCustomerCase(
  id: string,
  status: CustomerCaseStatus,
  responseNote: string,
) {
  await ensureCustomerCasesReady();
  const now = new Date().toISOString();
  const respondedAt =
    status === "responded" || status === "closed" ? now : null;

  const result = (await getCaseDb()
    .prepare(
      `UPDATE customer_cases
       SET status = ?,
           response_note = ?,
           responded_at = CASE
             WHEN ? IS NOT NULL THEN COALESCE(responded_at, ?)
             ELSE responded_at
           END,
           updated_at = ?
       WHERE id = ?`,
    )
    .bind(status, responseNote, respondedAt, respondedAt, now, id)
    .run()) as { meta?: { changes?: number } };

  return Boolean(result.meta?.changes);
}
