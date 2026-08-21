"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type AdminOrder = {
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

type OrdersPayload = {
  orders?: AdminOrder[];
  error?: string;
};

const statusLabels: Record<string, string> = {
  paid: "Opłacone",
  unpaid: "Nieopłacone",
  no_payment_required: "Bez płatności",
};

function statusClass(status: string) {
  if (status === "paid" || status === "no_payment_required") return "is-approved";
  if (status === "unpaid") return "is-pending";
  return "is-rejected";
}

function formatAmount(amount: number | null, currency: string | null) {
  if (amount === null) return "—";
  const code = (currency ?? "pln").toUpperCase();
  try {
    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: code,
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${code}`;
  }
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function shortId(value: string) {
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-6)}`;
}

export default function OrdersManager() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const paidCount = useMemo(
    () => orders.filter((order) => order.paymentStatus === "paid").length,
    [orders],
  );

  const loadOrders = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/orders", { cache: "no-store" });
      const body = await response.text();
      let data: OrdersPayload = {};
      if (body) {
        try {
          data = JSON.parse(body) as OrdersPayload;
        } catch {
          throw new Error("Sklep zwrócił nieprawidłową odpowiedź.");
        }
      }
      if (!response.ok) {
        throw new Error(data.error ?? "Nie udało się wczytać zamówień.");
      }
      setOrders(data.orders ?? []);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Nie udało się wczytać zamówień.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders(false);
  }, [loadOrders]);

  return (
    <section className="admin-reviews" aria-labelledby="admin-orders-title">
      <div className="admin-reviews-heading">
        <div>
          <p className="eyebrow">Stripe · zamówienia</p>
          <h2 id="admin-orders-title">Zamówienia i płatności</h2>
          <p>
            Lista jest aktualizowana przez podpisany webhook Stripe. Status „Opłacone”
            oznacza potwierdzenie płatności po stronie Stripe.
          </p>
        </div>
        <span>{paidCount} opłaconych</span>
      </div>

      <div className="admin-review-actions" style={{ marginBottom: "1rem" }}>
        <button
          type="button"
          onClick={() => void loadOrders(true)}
          disabled={refreshing}
        >
          {refreshing ? "Odświeżanie…" : "Odśwież zamówienia"}
        </button>
      </div>

      {error && (
        <p className="admin-message is-error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="admin-review-state">Wczytywanie zamówień…</p>
      ) : orders.length === 0 ? (
        <p className="admin-review-state">
          Nie ma jeszcze zapisanych zamówień. Pierwsze pojawi się po zdarzeniu Stripe.
        </p>
      ) : (
        <div className="admin-review-list">
          {orders.map((order) => (
            <article className="admin-review-card" key={order.sessionId}>
              <div className="admin-review-meta">
                <div>
                  <strong>{order.customerEmail ?? "Brak adresu e-mail"}</strong>
                  <small>{formatDate(order.updatedAt)}</small>
                </div>
                <span className={`review-status ${statusClass(order.paymentStatus)}`}>
                  {statusLabels[order.paymentStatus] ?? order.paymentStatus}
                </span>
              </div>

              <p>
                <strong>{formatAmount(order.amountTotal, order.currency)}</strong>
                {" · "}
                Zamówienie #{order.sessionId.slice(-8).toUpperCase()}
              </p>

              <div className="admin-review-meta">
                <div>
                  <small>Sesja Stripe</small>
                  <strong title={order.sessionId}>{shortId(order.sessionId)}</strong>
                </div>
                <div>
                  <small>Ostatnie zdarzenie</small>
                  <strong>{order.lastEventType}</strong>
                </div>
              </div>

              {order.checkoutStatus && (
                <p>
                  Status Checkout: <strong>{order.checkoutStatus}</strong>
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
