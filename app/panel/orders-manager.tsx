"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type FulfillmentStatus = "new" | "preparing" | "shipped" | "completed";
type RefundStatus = "none" | "partial" | "full";
type OrderSettings = { pickupEnabled: boolean; pickupAddress: string };
type AdminOrder = {
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
type OrdersPayload = {
  orders?: AdminOrder[];
  settings?: OrderSettings;
  error?: string;
};

const paymentLabels: Record<string, string> = {
  paid: "Opłacone",
  unpaid: "Nieopłacone",
  no_payment_required: "Bez płatności",
};
const refundLabels: Record<RefundStatus, string> = {
  none: "Brak zwrotu",
  partial: "Zwrot częściowy",
  full: "Zwrot pełny",
};
const fulfillmentLabels: Record<FulfillmentStatus, string> = {
  new: "Nowe",
  preparing: "W przygotowaniu",
  shipped: "Wysłane",
  completed: "Zakończone",
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
    return new Intl.NumberFormat("pl-PL", { style: "currency", currency: code }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${code}`;
  }
}
function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("pl-PL", { dateStyle: "medium", timeStyle: "short" });
}
function shortId(value: string) {
  return value.length <= 12 ? value : `${value.slice(0, 6)}…${value.slice(-6)}`;
}

export default function OrdersManager() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [settings, setSettings] = useState<OrderSettings>({ pickupEnabled: false, pickupAddress: "" });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workingId, setWorkingId] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const paidCount = useMemo(
    () =>
      orders.filter(
        (order) => order.paymentStatus === "paid" && order.refundStatus !== "full",
      ).length,
    [orders],
  );

  const applyPayload = (data: OrdersPayload) => {
    if (data.orders) setOrders(data.orders);
    if (data.settings) setSettings(data.settings);
  };

  const loadOrders = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/orders", { cache: "no-store" });
      const data = (await response.json()) as OrdersPayload;
      if (!response.ok) throw new Error(data.error ?? "Nie udało się wczytać zamówień.");
      if (data.orders) setOrders(data.orders);
      if (data.settings) setSettings(data.settings);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nie udało się wczytać zamówień.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void loadOrders(false);
    });
    return () => {
      active = false;
    };
  }, [loadOrders]);

  async function patch(body: Record<string, unknown>) {
    const response = await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as OrdersPayload;
    if (!response.ok) throw new Error(data.error ?? "Nie udało się zapisać zmian.");
    applyPayload(data);
  }

  async function changeFulfillment(order: AdminOrder, status: FulfillmentStatus) {
    setWorkingId(order.sessionId);
    setError("");
    setMessage("");
    try {
      await patch({ action: "fulfillment", sessionId: order.sessionId, status });
      setMessage(`Status zamówienia zmieniono na „${fulfillmentLabels[status]}”.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nie udało się zmienić statusu.");
    } finally {
      setWorkingId("");
    }
  }

  async function saveShipping(order: AdminOrder, form: HTMLFormElement) {
    setWorkingId(order.sessionId);
    setError("");
    setMessage("");
    const data = new FormData(form);
    try {
      await patch({
        action: "shipping",
        sessionId: order.sessionId,
        carrier: String(data.get("carrier") ?? ""),
        trackingNumber: String(data.get("trackingNumber") ?? ""),
        shippedAt: String(data.get("shippedAt") ?? "") || null,
      });
      setMessage("Dane przesyłki zostały zapisane.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nie udało się zapisać danych przesyłki.");
    } finally {
      setWorkingId("");
    }
  }

  async function savePickupSettings() {
    setSavingSettings(true);
    setError("");
    setMessage("");
    try {
      await patch({ action: "settings", settings });
      setMessage(
        settings.pickupEnabled
          ? "Odbiór osobisty został włączony."
          : "Odbiór osobisty został wyłączony.",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nie udało się zapisać ustawień odbioru.");
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <section className="admin-reviews" aria-labelledby="admin-orders-title">
      <div className="admin-reviews-heading">
        <div>
          <p className="eyebrow">Stripe · zamówienia</p>
          <h2 id="admin-orders-title">Zamówienia i realizacja</h2>
          <p>Płatność aktualizuje Stripe, a wysyłkę i status realizacji obsługujesz tutaj.</p>
        </div>
        <span>{paidCount} opłaconych</span>
      </div>

      <article className="admin-review-card" style={{ marginBottom: "1.25rem" }}>
        <div className="admin-review-meta">
          <div>
            <strong>Odbiór osobisty</strong>
            <small>Adres pojawi się klientowi jako bezpłatna opcja dostawy.</small>
          </div>
          <label className="admin-switch">
            <input
              type="checkbox"
              checked={settings.pickupEnabled}
              onChange={(event) =>
                setSettings((current) => ({ ...current, pickupEnabled: event.target.checked }))
              }
            />
            <span aria-hidden="true" />
          </label>
        </div>
        <label className="admin-field admin-field-wide">
          <span>Adres odbioru osobistego</span>
          <textarea
            rows={3}
            maxLength={240}
            value={settings.pickupAddress}
            onChange={(event) =>
              setSettings((current) => ({ ...current, pickupAddress: event.target.value }))
            }
            placeholder="Wpisz pełny adres odbioru osobistego"
          />
          <small>Adres nie jest publikowany, dopóki nie włączysz odbioru osobistego i nie zapiszesz ustawień.</small>
        </label>
        <div className="admin-review-actions">
          <button type="button" disabled={savingSettings} onClick={() => void savePickupSettings()}>
            {savingSettings ? "Zapisywanie…" : "Zapisz odbiór osobisty"}
          </button>
        </div>
      </article>

      <div className="admin-review-actions" style={{ marginBottom: "1rem" }}>
        <button type="button" onClick={() => void loadOrders(true)} disabled={refreshing}>
          {refreshing ? "Odświeżanie…" : "Odśwież zamówienia"}
        </button>
      </div>

      {(error || message) && (
        <p className={`admin-message ${error ? "is-error" : "is-success"}`} role="status">
          {error || message}
        </p>
      )}

      {loading ? (
        <p className="admin-review-state">Wczytywanie zamówień…</p>
      ) : orders.length === 0 ? (
        <p className="admin-review-state">Nie ma jeszcze zapisanych zamówień. Pierwsze pojawi się po zdarzeniu Stripe.</p>
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
                  {paymentLabels[order.paymentStatus] ?? order.paymentStatus}
                </span>
              </div>

              <p>
                <strong>{formatAmount(order.amountTotal, order.currency)}</strong>
                {" · "}Zamówienie #{order.sessionId.slice(-8).toUpperCase()}
              </p>

              {order.refundStatus !== "none" && (
                <p>
                  Zwrot: <strong>{refundLabels[order.refundStatus]}</strong>
                  {" · "}{formatAmount(order.amountRefunded, order.currency)}
                  {order.refundedAt ? ` · ${formatDate(order.refundedAt)}` : ""}
                </p>
              )}

              <div className="admin-review-meta">
                <div>
                  <small>Sesja Stripe</small>
                  <strong title={order.sessionId}>{shortId(order.sessionId)}</strong>
                </div>
                <div>
                  <small>Realizacja</small>
                  <strong>{fulfillmentLabels[order.fulfillmentStatus]}</strong>
                </div>
              </div>

              <div className="admin-review-actions" aria-label="Zmień status realizacji">
                {(Object.keys(fulfillmentLabels) as FulfillmentStatus[]).map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={order.fulfillmentStatus === status ? "" : "is-secondary"}
                    disabled={workingId === order.sessionId || order.fulfillmentStatus === status}
                    onClick={() => void changeFulfillment(order, status)}
                  >
                    {fulfillmentLabels[status]}
                  </button>
                ))}
              </div>

              <form
                className="site-editor-grid two-columns"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveShipping(order, event.currentTarget);
                }}
                style={{ marginTop: "1rem" }}
              >
                <label className="admin-field">
                  <span>Firma kurierska</span>
                  <input name="carrier" maxLength={80} defaultValue={order.carrier ?? ""} placeholder="np. InPost" />
                </label>
                <label className="admin-field">
                  <span>Numer przesyłki</span>
                  <input name="trackingNumber" maxLength={120} defaultValue={order.trackingNumber ?? ""} placeholder="Numer przesyłki" />
                </label>
                <label className="admin-field">
                  <span>Data wysyłki</span>
                  <input
                    name="shippedAt"
                    type="datetime-local"
                    defaultValue={order.shippedAt ? order.shippedAt.slice(0, 16) : ""}
                  />
                </label>
                <div className="admin-review-actions" style={{ alignItems: "end" }}>
                  <button type="submit" disabled={workingId === order.sessionId}>
                    {workingId === order.sessionId ? "Zapisywanie…" : "Zapisz dane przesyłki"}
                  </button>
                </div>
              </form>

              {(order.carrier || order.trackingNumber || order.shippedAt) && (
                <p>
                  Wysyłka: <strong>{order.carrier ?? "—"}</strong>
                  {order.trackingNumber ? ` · ${order.trackingNumber}` : ""}
                  {order.shippedAt ? ` · ${formatDate(order.shippedAt)}` : ""}
                </p>
              )}

              {order.checkoutStatus && <p>Status Checkout: <strong>{order.checkoutStatus}</strong></p>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
