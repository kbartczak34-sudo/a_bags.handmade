"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type AdminProduct = {
  id: string;
  name: string;
  isVisible: boolean;
  productIdentifier: string;
  batchCode: string;
  materials: string;
  careInstructions: string;
  safetyInfo: string;
};

type Payload = {
  products?: AdminProduct[];
  error?: string;
};

type Draft = Pick<
  AdminProduct,
  "productIdentifier" | "batchCode" | "materials" | "careInstructions" | "safetyInfo"
>;

const emptyDraft: Draft = {
  productIdentifier: "",
  batchCode: "",
  materials: "",
  careInstructions: "",
  safetyInfo: "",
};

function draftFromProduct(product: AdminProduct): Draft {
  return {
    productIdentifier: product.productIdentifier ?? "",
    batchCode: product.batchCode ?? "",
    materials: product.materials ?? "",
    careInstructions: product.careInstructions ?? "",
    safetyInfo: product.safetyInfo ?? "",
  };
}

function isComplete(product: AdminProduct) {
  return Boolean(
    product.productIdentifier.trim() &&
      product.materials.trim() &&
      product.careInstructions.trim() &&
      product.safetyInfo.trim(),
  );
}

export default function ProductComplianceManager() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selected = useMemo(
    () => products.find((product) => product.id === selectedId) ?? null,
    [products, selectedId],
  );
  const completeCount = useMemo(() => products.filter(isComplete).length, [products]);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/products", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as Payload;
        if (!response.ok) throw new Error(data.error ?? "Nie udało się wczytać produktów.");
        return data.products ?? [];
      })
      .then((items) => {
        if (!active) return;
        setProducts(items);
        const first = items[0];
        if (first) {
          setSelectedId(first.id);
          setDraft(draftFromProduct(first));
        }
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

  const selectProduct = (product: AdminProduct) => {
    setSelectedId(product.id);
    setDraft(draftFromProduct(product));
    setError("");
    setMessage("");
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedId) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/product-compliance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedId, ...draft }),
      });
      const data = (await response.json()) as Payload;
      if (!response.ok) throw new Error(data.error ?? "Nie udało się zapisać danych.");
      const items = data.products ?? [];
      setProducts(items);
      const refreshed = items.find((product) => product.id === selectedId);
      if (refreshed) setDraft(draftFromProduct(refreshed));
      setMessage("Dane identyfikacji, pielęgnacji i bezpieczeństwa zostały zapisane.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nie udało się zapisać danych.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="admin-reviews" aria-labelledby="product-compliance-title">
      <div className="admin-reviews-heading">
        <div>
          <p className="eyebrow">GPSR · dane produktu</p>
          <h2 id="product-compliance-title">Identyfikacja i bezpieczeństwo produktów</h2>
          <p>
            Uzupełnij rzeczywiste dane konkretnego modelu. Pola nie są automatycznie
            wypełniane, ponieważ muszą odpowiadać faktycznym materiałom i dokumentacji.
          </p>
        </div>
        <span>{completeCount}/{products.length} uzupełnionych</span>
      </div>

      {error && <p className="admin-message is-error" role="alert">{error}</p>}
      {message && <p className="admin-message is-success" role="status">{message}</p>}

      {loading ? (
        <p>Wczytywanie produktów…</p>
      ) : products.length === 0 ? (
        <p>Najpierw dodaj produkt w zakładce „Produkty”.</p>
      ) : (
        <div className="admin-layout">
          <aside className="admin-product-list" aria-label="Produkty do uzupełnienia">
            <div className="admin-list-heading">
              <strong>Modele</strong>
              <span>{products.length}</span>
            </div>
            {products.map((product) => (
              <button
                key={product.id}
                type="button"
                className={`admin-product-row ${selectedId === product.id ? "is-active" : ""}`}
                onClick={() => selectProduct(product)}
              >
                <span className="admin-product-miniature" aria-hidden="true">
                  {isComplete(product) ? "✓" : "!"}
                </span>
                <span>
                  <strong>{product.name}</strong>
                  <small>{product.productIdentifier || "Brak identyfikatora"}</small>
                </span>
                <span className={`admin-visibility ${isComplete(product) ? "is-visible" : ""}`}>
                  {isComplete(product) ? "Uzupełniony" : "Do uzupełnienia"}
                </span>
              </button>
            ))}
          </aside>

          <section className="admin-editor">
            <div className="admin-editor-heading">
              <div>
                <p className="eyebrow">Dane zgodności</p>
                <h2>{selected?.name ?? "Produkt"}</h2>
              </div>
            </div>

            <form className="admin-form" onSubmit={save}>
              <div className="admin-fields">
                <label className="admin-field">
                  <span>Identyfikator produktu / model / SKU</span>
                  <input
                    value={draft.productIdentifier}
                    maxLength={120}
                    onChange={(event) => setDraft({ ...draft, productIdentifier: event.target.value })}
                    placeholder="np. ABAGS-LILA-01"
                  />
                  <small>Użyj identyfikatora, który faktycznie stosujesz na produkcie lub dokumentacji.</small>
                </label>

                <label className="admin-field">
                  <span>Partia / seria / oznaczenie egzemplarza</span>
                  <input
                    value={draft.batchCode}
                    maxLength={120}
                    onChange={(event) => setDraft({ ...draft, batchCode: event.target.value })}
                    placeholder="Opcjonalne — zgodnie z przyjętym systemem identyfikacji"
                  />
                </label>

                <label className="admin-field admin-field-wide">
                  <span>Materiały i komponenty</span>
                  <textarea
                    rows={4}
                    maxLength={800}
                    value={draft.materials}
                    onChange={(event) => setDraft({ ...draft, materials: event.target.value })}
                    placeholder="Wpisz faktyczny skład: sznurek/tkanina, uchwyty, okucia, podszewka itd."
                  />
                  <small>{draft.materials.length}/800 znaków</small>
                </label>

                <label className="admin-field admin-field-wide">
                  <span>Pielęgnacja i sposób użytkowania</span>
                  <textarea
                    rows={5}
                    maxLength={1200}
                    value={draft.careInstructions}
                    onChange={(event) => setDraft({ ...draft, careInstructions: event.target.value })}
                    placeholder="Wpisz rzeczywiste instrukcje czyszczenia, przechowywania i użytkowania."
                  />
                  <small>{draft.careInstructions.length}/1200 znaków</small>
                </label>

                <label className="admin-field admin-field-wide">
                  <span>Informacje bezpieczeństwa / ostrzeżenia</span>
                  <textarea
                    rows={6}
                    maxLength={1600}
                    value={draft.safetyInfo}
                    onChange={(event) => setDraft({ ...draft, safetyInfo: event.target.value })}
                    placeholder="Wpisz ostrzeżenia wynikające z faktycznej analizy ryzyka produktu."
                  />
                  <small>{draft.safetyInfo.length}/1600 znaków</small>
                </label>
              </div>

              <p className="admin-message" role="note">
                Samo uzupełnienie pól w sklepie nie zastępuje wymaganej dokumentacji technicznej ani analizy ryzyka. Nie zaznaczaj globalnego potwierdzenia zgodności, dopóki dokumentacja faktycznie nie istnieje.
              </p>

              <div className="admin-form-actions">
                <a href="/bezpieczenstwo-produktow" target="_blank" rel="noreferrer">
                  Zobacz publiczną stronę bezpieczeństwa ↗
                </a>
                <button type="submit" disabled={saving || !selectedId}>
                  {saving ? "Zapisywanie…" : "Zapisz dane produktu"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
