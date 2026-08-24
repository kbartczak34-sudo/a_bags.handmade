import type Stripe from "stripe";
import { getRuntimeBindings } from "./runtime-env";

export type FulfillmentStatus = "new" | "preparing" | "shipped" | "completed";
export type RefundStatus = "none" | "partial" | "full";

export type AdminOrder = {
  sessionId: string;
  paymentIntentId: string | null;
  customerEmail: string | null;
  paymentStatus: string;
  refundStatus: RefundStatus;
  amountRefunded: number;
  refundedAt: string | null;
  checkoutStatus: string | null;
  fulfillmentStatus: FulfillmentStatus;
  carrier: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
  amountTotal: number | null;
  currency: string | null;
  cartReference: string | null;
  lastEventId: string;
  lastEventType: string;
  createdAt: string;
  updatedAt: string;
};

export type OrderSettings = {
  pickupEnabled: boolean;
  pickupAddress: string;
};

type OrderRow = {
  session_id: string;
  payment_intent_id: string | null;
  customer_email: string | null;
  payment_status: string;
  refund_status: string | null;
  amount_refunded: number | null;
  refunded_at: string | null;
  checkout_status: string | null;
  fulfillment_status: string | null;
  carrier: string | null;
  tracking_number: string | null;
  shipped_at: string | null;
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
    refund_status TEXT NOT NULL DEFAULT 'none',
    amount_refunded INTEGER NOT NULL DEFAULT 0,
    refunded_at TEXT,
    checkout_status TEXT,
    fulfillment_status TEXT NOT NULL DEFAULT 'new',
    carrier TEXT,
    tracking_number TEXT,
    shipped_at TEXT,
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

const createOrderSettingsSql = `
  CREATE TABLE IF NOT EXISTS order_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    pickup_enabled INTEGER NOT NULL DEFAULT 0,
    pickup_address TEXT NOT NULL DEFAULT ''
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

async function addColumn(sql: string) {
  try {
    await getOrderDb().prepare(sql).run();
  } catch {
    // Kolumna już istnieje.
  }
}

async function initializeOrders() {
  const db = getOrderDb();
  await db.batch([
    db.prepare(createOrdersSql),
    db.prepare(createStripeEventsSql),
    db.prepare(createOrderSettingsSql),
    db.prepare(createOrdersStatusIndexSql),
  ]);

  await addColumn("ALTER TABLE orders ADD COLUMN fulfillment_status TEXT NOT NULL DEFAULT 'new'");
  await addColumn("ALTER TABLE orders ADD COLUMN carrier TEXT");
  await addColumn("ALTER TABLE orders ADD COLUMN tracking_number TEXT");
  await addColumn("ALTER TABLE orders ADD COLUMN shipped_at TEXT");
  await addColumn("ALTER TABLE orders ADD COLUMN refund_status TEXT NOT NULL DEFAULT 'none'");
  await addColumn("ALTER TABLE orders ADD COLUMN amount_refunded INTEGER NOT NULL DEFAULT 0");
  await addColumn("ALTER TABLE orders ADD COLUMN refunded_at TEXT");

  await db
    .prepare("INSERT OR IGNORE INTO order_settings (id, pickup_enabled, pickup_address) VALUES (1, 0, '')")
    .run();
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
    refundStatus: (row.refund_status ?? "none") as RefundStatus,
    amountRefunded: row.amount_refunded ?? 0,
    refundedAt: row.refunded_at,
    checkoutStatus: row.checkout_status,
    fulfillmentStatus: (row.fulfillment_status ?? "new") as FulfillmentStatus,
    carrier: row.carrier,
    trackingNumber: row.tracking_number,
    shippedAt: row.shipped_at,
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
         session_id, payment_intent_id, customer_email, payment_status,
         checkout_status, amount_total, currency, cart_reference,
         last_event_id, last_event_type, created_at, updated_at
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

function chargePaymentIntentId(charge: Stripe.Charge) {
  if (typeof charge.payment_intent === "string") return charge.payment_intent;
  return charge.payment_intent?.id ?? null;
}

export async function recordStripeRefundEvent(
  event: Stripe.Event,
  charge: Stripe.Charge,
) {
  await ensureOrdersReady();
  const db = getOrderDb();
  const intentId = chargePaymentIntentId(charge);
  const now = new Date().toISOString();

  if (!intentId) {
    return { matched: false, refundStatus: "none" as RefundStatus };
  }

  const order = await db
    .prepare(
      "SELECT session_id, amount_refunded, refund_status FROM orders WHERE payment_intent_id = ? LIMIT 1",
    )
    .bind(intentId)
    .first<{
      session_id: string;
      amount_refunded: number | null;
      refund_status: string | null;
    }>();

  if (!order) {
    await db
      .prepare(
        "INSERT OR IGNORE INTO stripe_events (event_id, event_type, session_id, received_at) VALUES (?, ?, NULL, ?)",
      )
      .bind(event.id, event.type, now)
      .run();
    return { matched: false, refundStatus: "none" as RefundStatus };
  }

  const refundStatus: RefundStatus = charge.refunded
    ? "full"
    : charge.amount_refunded > 0
      ? "partial"
      : "none";
  const refundedAt =
    refundStatus === "none" ? null : new Date(event.created * 1000).toISOString();
  const previousAmountRefunded = order.amount_refunded ?? 0;

  if (charge.amount_refunded < previousAmountRefunded) {
    await db
      .prepare(
        "INSERT OR IGNORE INTO stripe_events (event_id, event_type, session_id, received_at) VALUES (?, ?, ?, ?)",
      )
      .bind(event.id, event.type, order.session_id, now)
      .run();
    return {
      matched: true,
      sessionId: order.session_id,
      refundStatus: (order.refund_status ?? "none") as RefundStatus,
      amountRefunded: previousAmountRefunded,
      ignoredAsStale: true,
    };
  }

  await db.batch([
    db.prepare(
      "INSERT OR IGNORE INTO stripe_events (event_id, event_type, session_id, received_at) VALUES (?, ?, ?, ?)",
    ).bind(event.id, event.type, order.session_id, now),
    db.prepare(
      `UPDATE orders
       SET refund_status = ?, amount_refunded = ?, refunded_at = ?,
           last_event_id = ?, last_event_type = ?, updated_at = ?
       WHERE session_id = ?`,
    ).bind(
      refundStatus,
      charge.amount_refunded,
      refundedAt,
      event.id,
      event.type,
      now,
      order.session_id,
    ),
  ]);

  return {
    matched: true,
    sessionId: order.session_id,
    refundStatus,
    amountRefunded: charge.amount_refunded,
  };
}

export async function listAdminOrders(limit = 100) {
  await ensureOrdersReady();
  const safeLimit = Math.max(1, Math.min(250, Math.trunc(limit)));
  const result = await getOrderDb()
    .prepare(
      `SELECT session_id, payment_intent_id, customer_email, payment_status,
              refund_status, amount_refunded, refunded_at,
              checkout_status, fulfillment_status, carrier, tracking_number,
              shipped_at, amount_total, currency, cart_reference, last_event_id,
              last_event_type, created_at, updated_at
       FROM orders
       ORDER BY updated_at DESC
       LIMIT ?`,
    )
    .bind(safeLimit)
    .all<OrderRow>();

  return result.results.map(toAdminOrder);
}

export async function updateFulfillmentStatus(
  sessionId: string,
  status: FulfillmentStatus,
) {
  await ensureOrdersReady();
  const allowed: FulfillmentStatus[] = ["new", "preparing", "shipped", "completed"];
  if (!allowed.includes(status)) throw new Error("Nieprawidłowy status realizacji.");
  const now = new Date().toISOString();
  await getOrderDb()
    .prepare("UPDATE orders SET fulfillment_status = ?, updated_at = ? WHERE session_id = ?")
    .bind(status, now, sessionId)
    .run();
  return listAdminOrders();
}

export async function updateShippingDetails(
  sessionId: string,
  details: { carrier?: string; trackingNumber?: string; shippedAt?: string | null },
) {
  await ensureOrdersReady();
  const carrier = (details.carrier ?? "").trim().slice(0, 80) || null;
  const trackingNumber = (details.trackingNumber ?? "").trim().slice(0, 120) || null;
  const shippedAt = details.shippedAt ? new Date(details.shippedAt).toISOString() : null;
  const now = new Date().toISOString();
  await getOrderDb()
    .prepare(
      `UPDATE orders
       SET carrier = ?, tracking_number = ?, shipped_at = ?, updated_at = ?
       WHERE session_id = ?`,
    )
    .bind(carrier, trackingNumber, shippedAt, now, sessionId)
    .run();
  return listAdminOrders();
}

export async function getOrderSettings(): Promise<OrderSettings> {
  await ensureOrdersReady();
  const row = await getOrderDb()
    .prepare("SELECT pickup_enabled, pickup_address FROM order_settings WHERE id = 1")
    .first<{ pickup_enabled: number; pickup_address: string }>();
  return {
    pickupEnabled: Boolean(row?.pickup_enabled),
    pickupAddress: row?.pickup_address ?? "",
  };
}

export async function updateOrderSettings(settings: OrderSettings) {
  await ensureOrdersReady();
  const address = settings.pickupAddress.trim().slice(0, 240);
  const enabled = settings.pickupEnabled && address.length > 0;
  await getOrderDb()
    .prepare(
      `INSERT INTO order_settings (id, pickup_enabled, pickup_address)
       VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         pickup_enabled = excluded.pickup_enabled,
         pickup_address = excluded.pickup_address`,
    )
    .bind(enabled ? 1 : 0, address)
    .run();
  return getOrderSettings();
}
