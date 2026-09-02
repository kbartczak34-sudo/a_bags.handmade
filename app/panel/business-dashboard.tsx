"use client";

import { useEffect, useMemo, useState } from "react";

type Order = {
  paymentStatus: string;
  amountTotal: number | null;
  amountRefunded?: number;
  fulfillmentStatus?: string;
  createdAt: string;
};

type Review = { status?: string };
type Product = { isVisible?: boolean };
type CustomerCase = { status?: string };

type DashboardData = {
  orders: Order[];
  reviews: Review[];
  products: Product[];
  cases: CustomerCase[];
};

const money = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" });

async function readJson(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Nie udało się wczytać danych.");
  return data as Record<string, unknown>;
}

export default function BusinessDashboard() {
  const [data, setData] = useState<DashboardData>({ orders: [], reviews: [], products: [], cases: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      readJson("/api/admin/orders"),
      readJson("/api/admin/reviews"),
      readJson("/api/admin/products"),
      readJson("/api/admin/customer-cases"),
    ]).then((results) => {
      if (!active) return;
      const [ordersResult, reviewsResult, productsResult, casesResult] = results;
      const ordersPayload = ordersResult.status === "fulfilled" ? ordersResult.value : {};
      const reviewsPayload = reviewsResult.status === "fulfilled" ? reviewsResult.value : {};
      const productsPayload = productsResult.status === "fulfilled" ? productsResult.value : {};
      const casesPayload = casesResult.status === "fulfilled" ? casesResult.value : {};
      setData({
        orders: Array.isArray(ordersPayload.orders) ? ordersPayload.orders as Order[] : [],
        reviews: Array.isArray(reviewsPayload.reviews) ? reviewsPayload.reviews as Review[] : [],
        products: Array.isArray(productsPayload.products) ? productsPayload.products as Product[] : [],
        cases: Array.isArray(casesPayload.cases) ? casesPayload.cases as CustomerCase[] : [],
      });
      if (results.every((result) => result.status === "rejected")) {
        setError("Nie udało się wczytać danych biznesowych.");
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const metrics = useMemo(() => {
    const today = new Date();
    const isToday = (value: string) => {
      const date = new Date(value);
      return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
    };
    const paidOrders = data.orders.filter((order) => order.paymentStatus === "paid" || order.paymentStatus === "no_payment_required");
    const revenueCents = paidOrders.reduce((sum, order) => sum + Math.max(0, (order.amountTotal ?? 0) - (order.amountRefunded ?? 0)), 0);
    const todayOrders = paidOrders.filter((order) => isToday(order.createdAt)).length;
    const activeOrders = paidOrders.filter((order) => order.fulfillmentStatus !== "completed").length;
    const pendingReviews = data.reviews.filter((review) => review.status === "pending").length;
    const visibleProducts = data.products.filter((product) => product.isVisible !== false).length;
    const openCases = data.cases.filter((item) => !["closed", "resolved", "completed"].includes(String(item.status ?? "").toLowerCase())).length;
    const attention = activeOrders + pendingReviews + openCases;
    return { revenueCents, todayOrders, activeOrders, pendingReviews, visibleProducts, openCases, attention };
  }, [data]);

  if (loading) {
    return <section className="abags-business-dashboard" aria-live="polite"><p>Wczytuję centrum dowodzenia…</p></section>;
  }

  return (
    <section className="abags-business-dashboard" aria-labelledby="business-dashboard-title">
      <style>{`
        .abags-business-dashboard{margin-bottom:1.5rem}.abags-business-dashboard-heading{display:flex;justify-content:space-between;gap:1rem;align-items:end;margin-bottom:1rem}.abags-business-dashboard-heading h2{margin:.25rem 0 0;font-family:var(--font-display);font-size:clamp(2.2rem,4vw,3.4rem);font-weight:500}.abags-dashboard-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.8rem}.abags-dashboard-card{min-height:132px;padding:1rem 1.05rem;border:1px solid color-mix(in srgb,var(--ink) 10%,transparent);border-radius:20px;background:color-mix(in srgb,var(--paper) 90%,white);display:flex;flex-direction:column}.abags-dashboard-card span{font:700 .62rem/1 var(--font-sans);letter-spacing:.12em;text-transform:uppercase;color:var(--rose-deep)}.abags-dashboard-card strong{margin:auto 0 .35rem;font-family:var(--font-display);font-size:2rem;font-weight:500}.abags-dashboard-card small{font:500 .7rem/1.45 var(--font-sans);opacity:.65}.abags-dashboard-attention{margin-top:.8rem;padding:.9rem 1rem;border-radius:16px;background:color-mix(in srgb,var(--cream) 82%,white);font:600 .78rem/1.5 var(--font-sans)}@media(max-width:980px){.abags-dashboard-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.abags-dashboard-grid{grid-template-columns:1fr}.abags-business-dashboard-heading{align-items:flex-start;flex-direction:column}}
      `}</style>
      <div className="abags-business-dashboard-heading">
        <div><p className="eyebrow">Dzisiaj · centrum dowodzenia</p><h2 id="business-dashboard-title">Sklep w liczbach</h2></div>
        <small>Wartości pobierane z aktualnych danych sklepu</small>
      </div>
      {error && <p className="admin-message is-error" role="alert">{error}</p>}
      <div className="abags-dashboard-grid">
        <article className="abags-dashboard-card"><span>Przychód</span><strong>{money.format(metrics.revenueCents / 100)}</strong><small>Opłacone zamówienia pomniejszone o zwroty</small></article>
        <article className="abags-dashboard-card"><span>Dzisiaj</span><strong>{metrics.todayOrders}</strong><small>Nowe opłacone zamówienia</small></article>
        <article className="abags-dashboard-card"><span>W realizacji</span><strong>{metrics.activeOrders}</strong><small>Zamówienia jeszcze niezakończone</small></article>
        <article className="abags-dashboard-card"><span>Produkty</span><strong>{metrics.visibleProducts}</strong><small>Modele widoczne w sklepie</small></article>
        <article className="abags-dashboard-card"><span>Opinie</span><strong>{metrics.pendingReviews}</strong><small>Czekają na moderację</small></article>
        <article className="abags-dashboard-card"><span>Sprawy</span><strong>{metrics.openCases}</strong><small>Zwroty i reklamacje wymagające obsługi</small></article>
        <article className="abags-dashboard-card"><span>Do uwagi</span><strong>{metrics.attention}</strong><small>Łącznie aktywne zamówienia, opinie i sprawy</small></article>
      </div>
      <div className="abags-dashboard-attention">
        {metrics.attention > 0 ? `Masz ${metrics.attention} elementów, które warto teraz sprawdzić w panelu.` : "Brak pilnych elementów — panel jest uporządkowany."}
      </div>
    </section>
  );
}
