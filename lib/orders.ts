import type Stripe from "stripe";
import { getRuntimeBindings } from "./runtime-env";

export type AdminOrder = {
  sessionId: string;
  paymentIntentId: string | null;
  customerEmail: string | null;
  paymentStatus: string;
  checkoutStatus: string | null;
  amountTotal: number | null;
  currency: string | null;
  cartReference: string | null;
  lastEventId: string;
  lastEventType: string;
  createdAt: string;
  updatedAt: string;
};

type OrderRow = {
  session_id: string;
  payment_intent_id: string | null;
  customer_email: string | null;
  payment_status: string;
  checkout_status: string | null;
  amount_total: number | null;
  currency: string | null;
  cart_reference: string | null;
  last_event_id: string;
  last_event_type: string;
  created_at: string;
  updated_at: string;
};

const createOrdersSql = `
  CREATE TABLE IF NOT EXISTS orders (
    session_id TEXT PRIMARY KEY NOT NULL,
    payment_intent_id TEXT,
    customer_email TEXT,
    payment_status TEXT NOT NULL,
    checkout_status TEXT,
    amount_total INTEGER,
    currency TEXT,
    cart_reference TEXT,
    last_event_id TEXT NOT NULL,
    last_event_type TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

const createStripeEventsSql = `
  CREATE TABLE IF NOT EXISTS stripe_events (
    event_id TEXT PRIMARY KEY NOT NULL,
    event_type TEXT NOT NULL,
    session_id TEXT,
    received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

const createOrdersStatusIndexSql = `
  CREATE INDEX IF NOT EXISTS orders_payment_status_updated_at_idx
  ON orders (payment_status, updated_at)
`;

let readyPromise: Promise<void> | null = null;

function getOrderDb() {
  const db = getRuntimeBindings().DB;
  if (!db) throw new Error("Brak połączenia z bazą zamówień.");
  return db;
}

async function initializeOrders() {
  const db = getOrderDb();
  await db.batch([
    db.prepare(createOrdersSql),
    db.prepare(createStripeEventsSql),
    db.prepare(createOrdersStatusIndexSql),
  ]);
}

export async function ensureOrdersReady() {
  readyPromise ??= initializeOrders();
  try {
    await readyPromise;
  } catch (error) {
    readyPromise = null;
    throw error;
  }
}

function paymentIntentId(session: Stripe.Checkout.Session) {
  if (typeof session.payment_intent === "string") return session.payment_intent;
  return session.payment_intent?.id ?? null;
}

function toAdminOrder(row: OrderRow): AdminOrder {
  return {
    sessionId: row.session_id,
    paymentIntentId: row.payment_intent_id,
    customerEmail: row.customer_email,
    paymentStatus: row.payment_status,
    checkoutStatus: row.checkout_status,
    amountTotal: row.amount_total,
    currency: row.currency,
    cartReference: row.cart_reference,
    lastEventId: row.last_event_id,
    lastEventType: row.last_event_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function recordStripeOrderEvent(
  event: Stripe.Event,
  session: Stripe.Checkout.Session,
) {
  await ensureOrdersReady();
  const db = getOrderDb();
  const now = new Date().toISOString();

  await db.batch([
    db.prepare(
      `INSERT OR IGNORE INTO stripe_events (event_id, event_type, session_id, received_at)
       VALUES (?, ?, ?, ?)`,
    ).bind(event.id, event.type, session.id, now),
    db.prepare(
      `INSERT INTO orders (
         session_id,
         payment_intent_id,
         customer_email,
         payment_status,
         checkout_status,
         amount_total,
         currency,
         cart_reference,
         last_event_id,
         last_event_type,
         created_at,
         updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(session_id) DO UPDATE SET
         payment_intent_id = excluded.payment_intent_id,
         customer_email = excluded.customer_email,
         payment_status = excluded.payment_status,
         checkout_status = excluded.checkout_status,
         amount_total = excluded.amount_total,
         currency = excluded.currency,
         cart_reference = excluded.cart_reference,
         last_event_id = excluded.last_event_id,
         last_event_type = excluded.last_event_type,
         updated_at = excluded.updated_at`,
    ).bind(
      session.id,
      paymentIntentId(session),
      session.customer_details?.email ?? session.customer_email ?? null,
      session.payment_status,
      session.status ?? null,
      session.amount_total ?? null,
      session.currency ?? null,
      session.metadata?.cart ?? null,
      event.id,
      event.type,
      now,
      now,
    ),
  ]);
}

export async function listAdminOrders(limit = 100) {
  await ensureOrdersReady();
  const safeLimit = Math.max(1, Math.min(250, Math.trunc(limit)));
  const result = await getOrderDb()
    .prepare(
      `SELECT
         session_id,
         payment_intent_id,
         customer_email,
         payment_status,
         checkout_status,
         amount_total,
         currency,
         cart_reference,
         last_event_id,
         last_event_type,
         created_at,
         updated_at
       FROM orders
       ORDER BY updated_at DESC
       LIMIT ?`,
    )
    .bind(safeLimit)
    .all<OrderRow>();

  return result.results.map(toAdminOrder);
}
