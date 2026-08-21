"use client";

import { useState } from "react";
import Link from "next/link";
import ProductPanel from "./product-panel";
import ReviewManager from "./review-manager";
import SiteContentEditor from "./site-content-editor";
import OrdersManager from "./orders-manager";

type AdminTab = "page" | "products" | "reviews" | "orders";

export default function AdminPanel({ ownerName }: { ownerName: string }) {
  const [activeTab, setActiveTab] = useState<AdminTab>("page");

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
            Zmieniaj całą stronę, produkty, opinie i sprawdzaj zamówienia w jednym
            miejscu — bez edycji kodu.
          </p>
        </div>
      </section>

      <nav className="admin-tabs" aria-label="Sekcje panelu">
        <button
          type="button"
          className={activeTab === "page" ? "is-active" : ""}
          onClick={() => setActiveTab("page")}
        >
          <span>01</span>
          Treść strony
        </button>
        <button
          type="button"
          className={activeTab === "products" ? "is-active" : ""}
          onClick={() => setActiveTab("products")}
        >
          <span>02</span>
          Produkty
        </button>
        <button
          type="button"
          className={activeTab === "reviews" ? "is-active" : ""}
          onClick={() => setActiveTab("reviews")}
        >
          <span>03</span>
          Opinie
        </button>
        <button
          type="button"
          className={activeTab === "orders" ? "is-active" : ""}
          onClick={() => setActiveTab("orders")}
        >
          <span>04</span>
          Zamówienia
        </button>
      </nav>

      <div className="admin-tab-content">
        {activeTab === "page" && <SiteContentEditor />}
        {activeTab === "products" && <ProductPanel />}
        {activeTab === "reviews" && <ReviewManager />}
        {activeTab === "orders" && <OrdersManager />}
      </div>
    </main>
  );
}
