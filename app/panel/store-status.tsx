"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type TechnicalStatus = {
  databaseReady: boolean;
  mediaReady: boolean;
  stripeReady: boolean;
  webhookReady: boolean;
  emailReady: boolean;
};

type StoreStatusPayload = {
  checkedAt: string;
  launchReady: boolean;
  checkoutGate: "ready" | "blocked";
  technical: TechnicalStatus;
  productCompliance: {
    ready: boolean;
    totalVisible: number;
    completeVisible: number;
    incomplete: Array<{ id: string; name: string }>;
  };
  legal: {
    launchReady: boolean;
    businessMode: "jdg" | "unregistered" | "unknown";
    vatMode: "active_23" | "exempt" | "unknown";
    transactionalEmailReady: boolean;
    readinessIssues: string[];
  };
  error?: string;
};

const labels: Array<[keyof TechnicalStatus, string, string]> = [
  ["databaseReady", "Baza D1", "Produkty, opinie i zamówienia"],
  ["mediaReady", "Magazyn R2", "Zdjęcia produktów"],
  ["stripeReady", "Stripe", "Tworzenie płatności"],
  ["webhookReady", "Webhook Stripe", "Potwierdzanie opłaconych zamówień"],
  ["emailReady", "E-maile transakcyjne", "Potwierdzenia zamówień dla klientek"],
];

function readableBusinessMode(value: StoreStatusPayload["legal"]["businessMode"]) {
  if (value === "jdg") return "JDG";
  if (value === "unregistered") return "Działalność nierejestrowana";
  return "Nieustalone";
}

function readableVatMode(value: StoreStatusPayload["legal"]["vatMode"]) {
  if (value === "active_23") return "VAT czynny 23%";
  if (value === "exempt") return "Zwolnienie z VAT";
  return "Nieustalone";
}

export default function StoreStatus() {
  const [status, setStatus] = useState<StoreStatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/status", { cache: "no-store" });
      const data = (await response.json()) as StoreStatusPayload;
      if (!response.ok) throw new Error(data.error ?? "Nie udało się sprawdzić statusu sklepu.");
      setStatus(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nie udało się sprawdzić statusu sklepu.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const technicalReadyCount = useMemo(() => {
    if (!status) return 0;
    return Object.values(status.technical).filter(Boolean).length;
  }, [status]);

  return (
    <section className="admin-reviews" aria-labelledby="store-status-title">
      <div className="admin-reviews-heading">
        <div>
          <p className="eyebrow">Produkcja · kontrola gotowości</p>
          <h2 id="store-status-title">Status sklepu</h2>
          <p>
            Jedno miejsce do sprawdzania infrastruktury, danych produktów, płatności,
            e-maili i blokad prawnych przed uruchomieniem sprzedaży.
          </p>
        </div>
        <button type="button" onClick={() => void load(true)} disabled={refreshing}>
          {refreshing ? "Sprawdzanie…" : "Odśwież status"}
        </button>
      </div>

      {error && <p className="admin-message is-error" role="alert">{error}</p>}
      {loading && <p>Sprawdzam konfigurację produkcyjną…</p>}

      {!loading && status && (
        <>
          <article className="admin-review-card" style={{ marginBottom: "1.25rem" }}>
            <div className="admin-review-meta">
              <div>
                <strong>{status.launchReady ? "Sklep gotowy do sprzedaży" : "Sprzedaż nadal zablokowana"}</strong>
                <small>
                  Checkout: {status.checkoutGate === "ready" ? "gotowy" : "fail-closed"} ·
                  infrastruktura: {technicalReadyCount}/5 · GPSR modeli: {status.productCompliance.completeVisible}/{status.productCompliance.totalVisible}
                </small>
              </div>
              <span className={status.launchReady ? "is-approved" : "is-pending"}>
                {status.launchReady ? "GOTOWY" : "WYMAGA DZIAŁAŃ"}
              </span>
            </div>
          </article>

          <div className="admin-review-list" style={{ marginBottom: "1.25rem" }}>
            {labels.map(([key, title, description]) => {
              const ready = status.technical[key];
              return (
                <article className="admin-review-card" key={key}>
                  <div className="admin-review-meta">
                    <div>
                      <strong>{title}</strong>
                      <small>{description}</small>
                    </div>
                    <span className={ready ? "is-approved" : "is-rejected"}>
                      {ready ? "OK" : "BRAK"}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>

          <article className="admin-review-card" style={{ marginBottom: "1.25rem" }}>
            <div className="admin-review-meta">
              <div>
                <strong>Dane GPSR widocznych produktów</strong>
                <small>
                  {status.productCompliance.completeVisible}/{status.productCompliance.totalVisible} modeli ma identyfikator, materiały, pielęgnację i informacje bezpieczeństwa.
                </small>
              </div>
              <span className={status.productCompliance.ready ? "is-approved" : "is-pending"}>
                {status.productCompliance.ready ? "OK" : "DO UZUPEŁNIENIA"}
              </span>
            </div>
            {status.productCompliance.incomplete.length > 0 && (
              <ul style={{ margin: "1rem 0 0", paddingLeft: "1.25rem", display: "grid", gap: ".45rem" }}>
                {status.productCompliance.incomplete.map((product) => (
                  <li key={product.id}>{product.name}</li>
                ))}
              </ul>
            )}
          </article>

          <article className="admin-review-card" style={{ marginBottom: "1.25rem" }}>
            <div className="admin-review-meta">
              <div>
                <strong>Konfiguracja prawna</strong>
                <small>
                  {readableBusinessMode(status.legal.businessMode)} · {readableVatMode(status.legal.vatMode)}
                </small>
              </div>
              <span className={status.legal.launchReady ? "is-approved" : "is-pending"}>
                {status.legal.launchReady ? "OK" : `${status.legal.readinessIssues.length} BLOKAD`}
              </span>
            </div>

            {status.legal.readinessIssues.length > 0 ? (
              <ul style={{ margin: "1rem 0 0", paddingLeft: "1.25rem", display: "grid", gap: ".55rem" }}>
                {status.legal.readinessIssues.map((issue) => <li key={issue}>{issue}</li>)}
              </ul>
            ) : (
              <p style={{ marginTop: "1rem" }}>Wszystkie wymagane potwierdzenia prawne są ustawione.</p>
            )}
          </article>

          <p style={{ opacity: 0.7, fontSize: ".85rem" }}>
            Ostatnia kontrola: {new Date(status.checkedAt).toLocaleString("pl-PL")}
          </p>
        </>
      )}
    </section>
  );
}
