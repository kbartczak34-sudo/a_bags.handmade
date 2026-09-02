"use client";

import { useState } from "react";
import Link from "next/link";
import ProductPanel from "./product-panel";
import StitchManager from "./stitch-manager";
import ProductComplianceManager from "./product-compliance-manager";
import ReviewManager from "./review-manager";
import SiteContentEditor from "./site-content-editor";
import OrdersManager from "./orders-manager";
import StoreStatus from "./store-status";
import CustomerCasesManager from "./customer-cases-manager";

type AdminTab =
  | "status"
  | "page"
  | "products"
  | "stitches"
  | "compliance"
  | "reviews"
  | "orders"
  | "cases";

export default function AdminPanel({ ownerName }: { ownerName: string }) {
  const [activeTab, setActiveTab] = useState<AdminTab>("status");

  return (
    <main className="admin-page">
      <header className="admin-header">
        <Link className="wordmark" href="/" aria-label="Wróć do sklepu">
          <span>a_bags</span>
          <small>handmade</small>
        </Link>
        <div>
          <span>Zalogowana: {ownerName}</span>
          <Link href="/">Zobacz sklep ↗</Link>
        </div>
      </header>

      <section className="admin-intro admin-dashboard-intro">
        <div>
          <p className="eyebrow">Panel właścicielki</p>
          <h1>Zarządzaj sklepem</h1>
          <p>
            Kontroluj gotowość produkcyjną, treści, produkty, techniki wykonania,
            dane bezpieczeństwa, opinie, zamówienia oraz sprawy posprzedażowe w jednym miejscu.
          </p>
        </div>
      </section>

      <nav className="admin-tabs" aria-label="Sekcje panelu">
        <button type="button" className={activeTab === "status" ? "is-active" : ""} onClick={() => setActiveTab("status")}>
          <span>01</span>Status sklepu
        </button>
        <button type="button" className={activeTab === "page" ? "is-active" : ""} onClick={() => setActiveTab("page")}>
          <span>02</span>Treść strony
        </button>
        <button type="button" className={activeTab === "products" ? "is-active" : ""} onClick={() => setActiveTab("products")}>
          <span>03</span>Produkty
        </button>
        <button type="button" className={activeTab === "stitches" ? "is-active" : ""} onClick={() => setActiveTab("stitches")}>
          <span>04</span>Sploty / ściegi
        </button>
        <button type="button" className={activeTab === "compliance" ? "is-active" : ""} onClick={() => setActiveTab("compliance")}>
          <span>05</span>GPSR produktów
        </button>
        <button type="button" className={activeTab === "reviews" ? "is-active" : ""} onClick={() => setActiveTab("reviews")}>
          <span>06</span>Opinie
        </button>
        <button type="button" className={activeTab === "orders" ? "is-active" : ""} onClick={() => setActiveTab("orders")}>
          <span>07</span>Zamówienia
        </button>
        <button type="button" className={activeTab === "cases" ? "is-active" : ""} onClick={() => setActiveTab("cases")}>
          <span>08</span>Zwroty / reklamacje
        </button>
      </nav>

      <div className="admin-tab-content">
        {activeTab === "status" && <StoreStatus />}
        {activeTab === "page" && <SiteContentEditor />}
        {activeTab === "products" && <ProductPanel />}
        {activeTab === "stitches" && <StitchManager />}
        {activeTab === "compliance" && <ProductComplianceManager />}
        {activeTab === "reviews" && <ReviewManager />}
        {activeTab === "orders" && <OrdersManager />}
        {activeTab === "cases" && <CustomerCasesManager />}
      </div>
    </main>
  );
}
