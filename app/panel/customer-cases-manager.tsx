"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type CustomerCaseType = "withdrawal" | "complaint";
type CustomerCaseStatus = "new" | "in_review" | "responded" | "closed";

type AdminCustomerCase = {
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

type CasesPayload = {
  cases?: AdminCustomerCase[];
  error?: string;
};

const statusLabels: Record<CustomerCaseStatus, string> = {
  new: "Nowa",
  in_review: "W trakcie",
  responded: "Odpowiedziano",
  closed: "Zamknięta",
};

const typeLabels: Record<CustomerCaseType, string> = {
  complaint: "Reklamacja",
  withdrawal: "Odstąpienie",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("pl-PL", { dateStyle: "medium", timeStyle: "short" });
}

function dueLabel(item: AdminCustomerCase) {
  if (item.type !== "complaint" || !item.responseDueAt) {
    return { label: "Brak ustawowego timera reklamacyjnego", className: "" };
  }
  if (item.status === "responded" || item.status === "closed") {
    return { label: `Termin: ${formatDate(item.responseDueAt)}`, className: "is-approved" };
  }
  const due = new Date(item.responseDueAt).getTime();
  const now = Date.now();
  const days = Math.ceil((due - now) / 86_400_000);
  if (days < 0) {
    return { label: `Po terminie o ${Math.abs(days)} dni`, className: "is-rejected" };
  }
  if (days <= 2) {
    return { label: `Pilne · zostało ${days} dni`, className: "is-pending" };
  }
  return { label: `Termin odpowiedzi: ${formatDate(item.responseDueAt)}`, className: "is-approved" };
}

export default function CustomerCasesManager() {
  const [cases, setCases] = useState<AdminCustomerCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workingId, setWorkingId] = useState("");
  const [filter, setFilter] = useState<"open" | "all" | CustomerCaseType>("open");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/customer-cases", { cache: "no-store" });
      const payload = (await response.json()) as CasesPayload;
      if (!response.ok) {
        throw new Error(payload.error ?? "Nie udało się wczytać spraw klientów.");
      }
      setCases(payload.cases ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nie udało się wczytać spraw klientów.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void load(false);
    });
    return () => {
      active = false;
    };
  }, [load]);

  const visibleCases = useMemo(() => {
    if (filter === "all") return cases;
    if (filter === "open") {
      return cases.filter((item) => item.status === "new" || item.status === "in_review");
    }
    return cases.filter((item) => item.type === filter);
  }, [cases, filter]);

  const openCount = useMemo(
    () => cases.filter((item) => item.status === "new" || item.status === "in_review").length,
    [cases],
  );

  async function save(event: FormEvent<HTMLFormElement>, item: AdminCustomerCase) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setWorkingId(item.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/customer-cases", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          status: String(data.get("status") ?? item.status),
          responseNote: String(data.get("responseNote") ?? ""),
        }),
      });
      const payload = (await response.json()) as CasesPayload;
      if (!response.ok) {
        throw new Error(payload.error ?? "Nie udało się zapisać sprawy.");
      }
      setCases(payload.cases ?? []);
      setMessage(`Sprawa ${item.id} została zaktualizowana.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nie udało się zapisać sprawy.");
    } finally {
      setWorkingId("");
    }
  }

  return (
    <section className="admin-reviews" aria-labelledby="customer-cases-title">
      <div className="admin-reviews-heading">
        <div>
          <p className="eyebrow">Obsługa posprzedażowa</p>
          <h2 id="customer-cases-title">Zwroty i reklamacje</h2>
          <p>
            Zgłoszenia klientek zapisane w D1. Reklamacje mają automatycznie liczony
            14-dniowy termin odpowiedzi, a panel pokazuje potwierdzenie e-mail.
          </p>
        </div>
        <span>{openCount} otwartych</span>
      </div>

      <div className="admin-review-actions" style={{ marginBottom: "1rem", flexWrap: "wrap" }}>
        <button type="button" className={filter === "open" ? "is-active" : ""} onClick={() => setFilter("open")}>Otwarte</button>
        <button type="button" className={filter === "complaint" ? "is-active" : ""} onClick={() => setFilter("complaint")}>Reklamacje</button>
        <button type="button" className={filter === "withdrawal" ? "is-active" : ""} onClick={() => setFilter("withdrawal")}>Odstąpienia</button>
        <button type="button" className={filter === "all" ? "is-active" : ""} onClick={() => setFilter("all")}>Wszystkie</button>
        <button type="button" disabled={refreshing} onClick={() => void load(true)}>
          {refreshing ? "Odświeżanie…" : "Odśwież"}
        </button>
      </div>

      {error && <p className="admin-message is-error" role="alert">{error}</p>}
      {message && <p className="admin-message is-success" role="status">{message}</p>}
      {loading && <p>Wczytywanie zgłoszeń…</p>}

      {!loading && visibleCases.length === 0 && (
        <article className="admin-review-card">
          <p>Brak spraw pasujących do wybranego filtra.</p>
        </article>
      )}

      <div className="admin-review-list">
        {visibleCases.map((item) => {
          const due = dueLabel(item);
          return (
            <article className="admin-review-card" key={item.id}>
              <div className="admin-review-meta">
                <div>
                  <strong>{typeLabels[item.type]} · {item.id}</strong>
                  <small>
                    {formatDate(item.createdAt)} · {item.customerName} · {item.email}
                  </small>
                </div>
                <span className={due.className}>{due.label}</span>
              </div>

              <div style={{ display: "grid", gap: ".55rem", margin: "1rem 0" }}>
                <p style={{ margin: 0 }}><strong>Status:</strong> {statusLabels[item.status]}</p>
                <p style={{ margin: 0 }}>
                  <strong>Potwierdzenie e-mail:</strong>{" "}
                  {item.confirmationEmailSentAt
                    ? `wysłane ${formatDate(item.confirmationEmailSentAt)}`
                    : "brak potwierdzonej wysyłki — sprawdź kontakt z klientką"}
                </p>
                <p style={{ margin: 0 }}><strong>Zamówienie:</strong> {item.orderReference || "nie podano"}</p>
                <p style={{ margin: 0 }}><strong>Produkt:</strong> {item.productName || "nie podano"}</p>
                <p style={{ margin: 0, whiteSpace: "pre-wrap" }}><strong>Opis:</strong> {item.description}</p>
                {item.requestedResolution && (
                  <p style={{ margin: 0 }}><strong>Oczekiwane rozwiązanie:</strong> {item.requestedResolution}</p>
                )}
                {item.respondedAt && (
                  <p style={{ margin: 0 }}><strong>Odpowiedź odnotowana:</strong> {formatDate(item.respondedAt)}</p>
                )}
                <a href={`mailto:${encodeURIComponent(item.email)}?subject=${encodeURIComponent(`a_bags.handmade — sprawa ${item.id}`)}`}>
                  Napisz do klientki ↗
                </a>
              </div>

              <form onSubmit={(event) => void save(event, item)} style={{ display: "grid", gap: ".75rem" }}>
                <label className="admin-field">
                  <span>Status sprawy</span>
                  <select name="status" defaultValue={item.status}>
                    <option value="new">Nowa</option>
                    <option value="in_review">W trakcie</option>
                    <option value="responded">Odpowiedziano</option>
                    <option value="closed">Zamknięta</option>
                  </select>
                </label>
                <label className="admin-field admin-field-wide">
                  <span>Notatka wewnętrzna / podsumowanie odpowiedzi</span>
                  <textarea
                    name="responseNote"
                    rows={5}
                    maxLength={4000}
                    defaultValue={item.responseNote}
                    placeholder="Np. data kontaktu, ustalone rozwiązanie, numer zwrotu płatności…"
                  />
                </label>
                <div className="admin-review-actions">
                  <button type="submit" disabled={workingId === item.id}>
                    {workingId === item.id ? "Zapisywanie…" : "Zapisz sprawę"}
                  </button>
                </div>
              </form>
            </article>
          );
        })}
      </div>
    </section>
  );
}
