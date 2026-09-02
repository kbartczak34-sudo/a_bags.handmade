"use client";

import { useEffect, useState } from "react";

type AdminProduct = {
  id: string;
  name: string;
  detail: string;
  stitchType: string;
  priceCents: number;
  sortOrder: number;
  isVisible: boolean;
  imageUrl: string | null;
};

type ApiPayload = {
  error?: string;
  products?: AdminProduct[];
};

export default function StitchManager() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const syncProducts = (items: AdminProduct[]) => {
    setProducts(items);
    setDrafts(
      Object.fromEntries(items.map((product) => [product.id, product.stitchType ?? ""])),
    );
  };

  useEffect(() => {
    let active = true;
    fetch("/api/admin/products", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as ApiPayload;
        if (!response.ok) throw new Error(data.error ?? "Nie udało się wczytać produktów.");
        return data.products ?? [];
      })
      .then((items) => {
        if (active) syncProducts(items);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Nie udało się wczytać produktów.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const saveStitch = async (product: AdminProduct) => {
    const stitchType = (drafts[product.id] ?? "").trim();
    if (stitchType.length > 80) {
      setError("Nazwa splotu lub ściegu może mieć maksymalnie 80 znaków.");
      return;
    }

    setSavingId(product.id);
    setMessage("");
    setError("");

    try {
      const formData = new FormData();
      formData.set("id", product.id);
      formData.set("name", product.name);
      formData.set("detail", product.detail);
      formData.set("stitchType", stitchType);
      formData.set("price", (product.priceCents / 100).toFixed(2));
      formData.set("sortOrder", String(product.sortOrder));
      formData.set("isVisible", String(product.isVisible));
      formData.set("removeImage", "false");

      const response = await fetch("/api/admin/products", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as ApiPayload;
      if (!response.ok) throw new Error(data.error ?? "Nie udało się zapisać splotu.");

      syncProducts(data.products ?? products);
      setMessage(`Zapisano technikę dla „${product.name}”.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nie udało się zapisać splotu.");
    } finally {
      setSavingId("");
    }
  };

  return (
    <section className="admin-stitches" aria-labelledby="admin-stitches-title">
      <div className="admin-module-heading">
        <div>
          <p className="eyebrow">Galeria technik</p>
          <h2 id="admin-stitches-title">Sploty / ściegi torebek</h2>
          <p>
            Przypisz produkt do techniki wykonania. Modele z taką samą nazwą zostaną
            automatycznie zgrupowane w galerii na stronie sklepu.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="admin-list-state">Wczytywanie produktów…</p>
      ) : products.length === 0 ? (
        <p className="admin-list-state">Najpierw dodaj produkty do katalogu.</p>
      ) : (
        <div className="stitch-admin-grid">
          {products.map((product) => (
            <article className="stitch-admin-card" key={product.id}>
              <div className="stitch-admin-product">
                <div className="stitch-admin-thumb">
                  {product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span aria-hidden="true">◇</span>}
                </div>
                <div>
                  <strong>{product.name}</strong>
                  <small>{product.isVisible ? "Widoczny w sklepie" : "Produkt ukryty"}</small>
                </div>
              </div>
              <label className="admin-field">
                <span>Splot / ścieg</span>
                <input
                  value={drafts[product.id] ?? ""}
                  onChange={(event) =>
                    setDrafts((current) => ({ ...current, [product.id]: event.target.value }))
                  }
                  placeholder="np. splot muszelkowy"
                  maxLength={80}
                />
                <small>Pusta wartość wyłącza produkt z galerii technik.</small>
              </label>
              <button
                className="stitch-save-button"
                type="button"
                disabled={savingId === product.id}
                onClick={() => saveStitch(product)}
              >
                {savingId === product.id ? "Zapisywanie…" : "Zapisz technikę"}
              </button>
            </article>
          ))}
        </div>
      )}

      {(message || error) && (
        <p className={`admin-message ${error ? "is-error" : "is-success"}`} role="status">
          {error || message}
        </p>
      )}
    </section>
  );
}
