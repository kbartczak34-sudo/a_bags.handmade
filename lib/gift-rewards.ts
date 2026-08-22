import type Stripe from "stripe";
import { getRuntimeBindings } from "./runtime-env";
import { getStripe } from "./stripe";

const GIFT_LIMIT = 10;
const GIFT_PERCENT = 35;
const COUPON_ID = "abags-first10-35";

type GiftSlotRow = {
  slot: number;
  session_id: string | null;
  customer_email: string | null;
  promotion_code: string | null;
  promotion_code_id: string | null;
  email_status: string;
  email_error: string | null;
};

const createGiftSlotsSql = `
  CREATE TABLE IF NOT EXISTS gift_slots (
    slot INTEGER PRIMARY KEY CHECK (slot BETWEEN 1 AND 10),
    session_id TEXT UNIQUE,
    customer_email TEXT,
    promotion_code TEXT,
    promotion_code_id TEXT,
    email_status TEXT NOT NULL DEFAULT 'available',
    email_error TEXT,
    claimed_at TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

let readyPromise: Promise<void> | null = null;

function getDb() {
  const db = getRuntimeBindings().DB;
  if (!db) throw new Error("Brak połączenia z bazą kodów rabatowych.");
  return db;
}

async function initializeGiftSlots() {
  const db = getDb();
  await db.prepare(createGiftSlotsSql).run();
  const statements = Array.from({ length: GIFT_LIMIT }, (_, index) =>
    db.prepare("INSERT OR IGNORE INTO gift_slots (slot) VALUES (?)").bind(index + 1),
  );
  await db.batch(statements);
}

async function ensureGiftSlotsReady() {
  readyPromise ??= initializeGiftSlots();
  try {
    await readyPromise;
  } catch (error) {
    readyPromise = null;
    throw error;
  }
}

function makeCode(slot: number) {
  const random = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  return `ABAGS35-${String(slot).padStart(2, "0")}-${random}`;
}

async function claimOrReadSlot(session: Stripe.Checkout.Session) {
  await ensureGiftSlotsReady();
  const db = getDb();
  const existing = await db
    .prepare("SELECT slot, session_id, customer_email, promotion_code, promotion_code_id, email_status, email_error FROM gift_slots WHERE session_id = ?")
    .bind(session.id)
    .first<GiftSlotRow>();
  if (existing) return existing;

  const email = session.customer_details?.email ?? session.customer_email ?? null;
  if (!email) return null;
  const now = new Date().toISOString();
  return db
    .prepare(`
      UPDATE gift_slots
      SET session_id = ?, customer_email = ?, email_status = 'claimed', claimed_at = ?, updated_at = ?
      WHERE slot = (
        SELECT slot FROM gift_slots WHERE session_id IS NULL ORDER BY slot ASC LIMIT 1
      )
      AND session_id IS NULL
      RETURNING slot, session_id, customer_email, promotion_code, promotion_code_id, email_status, email_error
    `)
    .bind(session.id, email, now, now)
    .first<GiftSlotRow>();
}

async function getOrCreateCoupon() {
  const stripe = getStripe();
  try {
    const coupon = await stripe.coupons.retrieve(COUPON_ID);
    if (!("deleted" in coupon) || !coupon.deleted) return coupon.id;
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status !== 404) throw error;
  }

  const coupon = await stripe.coupons.create({
    id: COUPON_ID,
    percent_off: GIFT_PERCENT,
    duration: "once",
    name: "Prezent A-Bags: -35% na kolejny zakup",
    metadata: { campaign: "first-10-orders" },
  });
  return coupon.id;
}

async function ensurePromotionCode(row: GiftSlotRow) {
  if (row.promotion_code && row.promotion_code_id) return row;
  const code = row.promotion_code ?? makeCode(row.slot);
  const couponId = await getOrCreateCoupon();
  const promotion = await getStripe().promotionCodes.create({
    promotion: { type: "coupon", coupon: couponId },
    code,
    max_redemptions: 1,
    metadata: {
      campaign: "first-10-orders",
      qualifying_session: row.session_id ?? "",
      gift_slot: String(row.slot),
    },
  });

  const now = new Date().toISOString();
  await getDb()
    .prepare(`UPDATE gift_slots SET promotion_code = ?, promotion_code_id = ?, email_status = 'ready', email_error = NULL, updated_at = ? WHERE slot = ?`)
    .bind(code, promotion.id, now, row.slot)
    .run();
  return { ...row, promotion_code: code, promotion_code_id: promotion.id, email_status: "ready", email_error: null };
}

function readEmailConfig() {
  const runtime = getRuntimeBindings();
  const apiKey = runtime.RESEND_API_KEY ?? process.env.RESEND_API_KEY;
  const from = runtime.ORDER_EMAIL_FROM ?? process.env.ORDER_EMAIL_FROM;
  if (!apiKey || !from) return null;
  return { apiKey: apiKey.trim(), from: from.trim() };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

async function sendGiftEmail(row: GiftSlotRow) {
  if (!row.customer_email || !row.promotion_code) return false;
  if (row.email_status === "sent") return true;

  const config = readEmailConfig();
  if (!config) {
    await getDb().prepare("UPDATE gift_slots SET email_status = 'pending_email_config', email_error = ?, updated_at = ? WHERE slot = ?")
      .bind("Brak RESEND_API_KEY lub ORDER_EMAIL_FROM", new Date().toISOString(), row.slot).run();
    return false;
  }

  const code = escapeHtml(row.promotion_code);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.from,
      to: [row.customer_email],
      subject: "Prezent od a_bags.handmade — -35% na kolejny zakup",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#4f383b;line-height:1.6">
          <h1 style="font-size:30px;margin-bottom:12px">Dziękujemy za zamówienie 🤍</h1>
          <p>Twoje zamówienie znalazło się wśród pierwszych 10 zamówień a_bags.handmade.</p>
          <p>W prezencie otrzymujesz <strong>35% rabatu na kolejny zakup</strong>.</p>
          <div style="margin:28px 0;padding:22px;border:1px solid #d6a3a7;background:#fffaf8;text-align:center">
            <div style="font-size:13px;margin-bottom:8px">Twój jednorazowy kod rabatowy</div>
            <strong style="font-size:26px;letter-spacing:1px">${code}</strong>
          </div>
          <p>Kod jest jednorazowy i może zostać użyty przy kolejnym zamówieniu w sklepie. Wpisz go w polu kodu promocyjnego w Stripe Checkout.</p>
          <p style="margin-top:28px">Z ciepłymi pozdrowieniami,<br><strong>a_bags.handmade</strong></p>
        </div>`,
    }),
  });

  const now = new Date().toISOString();
  if (!response.ok) {
    const body = (await response.text()).slice(0, 500);
    await getDb().prepare("UPDATE gift_slots SET email_status = 'email_failed', email_error = ?, updated_at = ? WHERE slot = ?")
      .bind(body || `HTTP ${response.status}`, now, row.slot).run();
    throw new Error(`Gift email failed: ${response.status}`);
  }

  await getDb().prepare("UPDATE gift_slots SET email_status = 'sent', email_error = NULL, updated_at = ? WHERE slot = ?")
    .bind(now, row.slot).run();
  return true;
}

export async function processFirstTenGift(session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") return null;
  const claimed = await claimOrReadSlot(session);
  if (!claimed) return null;
  const ready = await ensurePromotionCode(claimed);
  try {
    await sendGiftEmail(ready);
  } catch (error) {
    console.error("First-ten gift email failed", {
      sessionId: session.id,
      slot: ready.slot,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
  return { slot: ready.slot, code: ready.promotion_code };
}
