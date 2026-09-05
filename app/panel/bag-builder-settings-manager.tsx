"use client";

import { useEffect, useState } from "react";

type Family = "tote" | "round" | "bucket" | "mini";
type Settings = {
  pricingEnabled: boolean;
  familyBaseCents: Record<Family, number | null>;
  familyProductIds: Record<Family, string | null>;
  stitchCents: Record<"classic" | "herringbone" | "basket" | "shell", number>;
  flapCents: Record<"none" | "crochet" | "leather-black" | "leather-cognac" | "suede-burgundy", number>;
  handlesCents: Record<"none" | "wood-light" | "wood-dark" | "crochet", number>;
  strapCents: Record<"none" | "leather" | "woven" | "chain", number>;
  hardwareCents: Record<"gold" | "silver" | "black", number>;
  accentCents: Record<"none" | "tassel" | "scarf" | "charm", number>;
  compatibility: {
    handles: Record<Family, string[]>;
    straps: Record<Family, string[]>;
    flaps: Record<Family, string[]>;
  };
  updatedAt?: string | null;
};

type ProductOption = { id: string; name: string; price: number };

const FAMILY_LABELS: Record<Family, string> = { tote: "Kuferek / tote", round: "Okrągła", bucket: "Z klapą", mini: "Strukturalna / mini" };
const PRICE_GROUPS = [
  ["stitchCents", "Ścieg szydełkowy", { classic: "Ażurowy V", herringbone: "Pionowy ażurowy", basket: "Koszykowy", shell: "Promienisty" }],
  ["flapCents", "Klapa", { none: "Bez klapy", crochet: "Szydełkowa", "leather-black": "Skórzana czarna", "leather-cognac": "Skórzana koniak", "suede-burgundy": "Zamszowa bordo" }],
  ["handlesCents", "Uchwyty", { none: "Bez uchwytu", "wood-light": "Drewno jasne", "wood-dark": "Drewno ciemne", crochet: "Szydełkowy" }],
  ["strapCents", "Pasek", { none: "Bez paska", leather: "Skórzany", woven: "Tkany", chain: "Łańcuszek" }],
  ["hardwareCents", "Okucia", { gold: "Złote", silver: "Srebrne", black: "Czarne" }],
  ["accentCents", "Detal", { none: "Bez ozdoby", tassel: "Chwost", scarf: "Apaszka / kokarda", charm: "Zawieszka" }],
] as const;

function fromPln(value: string) {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0;
}

function toPln(value: number | null) {
  return value === null ? "" : (value / 100).toFixed(2).replace(".", ",");
}

function formatProductPrice(price: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(price);
}

export default function BagBuilderSettingsManager() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/bag-builder-settings", { cache: "no-store" }).then(async (response) => {
        const payload = await response.json() as { settings?: Settings; error?: string };
        if (!response.ok || !payload.settings) throw new Error(payload.error || "Nie udało się wczytać ustawień.");
        return payload.settings;
      }),
      fetch("/api/products", { cache: "no-store" }).then(async (response) => {
        const payload = await response.json() as { products?: ProductOption[]; error?: string };
        if (!response.ok || !Array.isArray(payload.products)) throw new Error(payload.error || "Nie udało się wczytać produktów.");
        return payload.products;
      }),
    ])
      .then(([nextSettings, nextProducts]) => {
        setSettings(nextSettings);
        setProducts(nextProducts);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Nie udało się wczytać ustawień."));
  }, []);

  const save = async () => {
    if (!settings) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/bag-builder-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const payload = await response.json() as { settings?: Settings; error?: string };
      if (!response.ok || !payload.settings) throw new Error(payload.error || "Nie udało się zapisać ustawień.");
      setSettings(payload.settings);
      setMessage("Ustawienia Bag Buildera zapisane ✓");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się zapisać ustawień.");
    } finally {
      setBusy(false);
    }
  };

  if (!settings) return <section className="builder-admin-card"><p>{message || "Wczytywanie ustawień Bag Buildera…"}</p></section>;

  return <section className="builder-admin-card">
    <header className="builder-admin-heading">
      <div><p className="eyebrow">Bag Builder · sprzedaż</p><h2>Cena na żywo i bezpieczna sprzedaż</h2><p>Ustawiaj prawdziwe ceny oraz przypisz każdy fason do realnego produktu katalogowego. Dopóki nie skonfigurujesz obu elementów, klient nadal może wysłać projekt do konsultacji, ale zakup online pozostaje zablokowany.</p></div>
      <label className="builder-admin-switch"><input type="checkbox" checked={settings.pricingEnabled} onChange={(event) => setSettings({ ...settings, pricingEnabled: event.currentTarget.checked })} /><span>Włącz cenę na żywo</span></label>
    </header>

    <div className="builder-admin-section">
      <h3>Produkt bazowy do bezpiecznej sprzedaży</h3>
      <p>Powiązanie pozwala checkoutowi ponownie sprawdzić rzeczywisty produkt, jego dostępność oraz dane bezpieczeństwa/GPSR przed utworzeniem płatności Stripe.</p>
      <div className="builder-admin-grid">
        {(Object.keys(FAMILY_LABELS) as Family[]).map((family) => <label key={family}>
          <span>{FAMILY_LABELS[family]}</span>
          <select value={settings.familyProductIds[family] ?? ""} onChange={(event) => setSettings({ ...settings, familyProductIds: { ...settings.familyProductIds, [family]: event.currentTarget.value || null } })}>
            <option value="">Nie przypisano — tylko konsultacja</option>
            {products.map((product) => <option value={product.id} key={product.id}>{product.name} · {formatProductPrice(product.price)}</option>)}
          </select>
        </label>)}
      </div>
    </div>

    <div className="builder-admin-section"><h3>Cena bazowa fasonu</h3><div className="builder-admin-grid">{(Object.keys(FAMILY_LABELS) as Family[]).map((key) => <label key={key}><span>{FAMILY_LABELS[key]}</span><div><input inputMode="decimal" value={toPln(settings.familyBaseCents[key])} placeholder="np. 249,00" onChange={(event) => setSettings({ ...settings, familyBaseCents: { ...settings.familyBaseCents, [key]: event.currentTarget.value.trim() ? fromPln(event.currentTarget.value) : null } })} /><em>zł</em></div></label>)}</div></div>

    <div className="builder-admin-section"><h3>Dopłaty do opcji</h3>{PRICE_GROUPS.map(([groupKey, title, labels]) => <div className="builder-admin-price-group" key={groupKey}><strong>{title}</strong><div className="builder-admin-grid">{Object.entries(labels).map(([key, text]) => <label key={key}><span>{text}</span><div><input inputMode="decimal" value={toPln((settings[groupKey] as Record<string, number>)[key] ?? 0)} onChange={(event) => setSettings({ ...settings, [groupKey]: { ...(settings[groupKey] as Record<string, number>), [key]: fromPln(event.currentTarget.value) } })} /><em>zł</em></div></label>)}</div></div>)}</div>

    <div className="builder-admin-note"><strong>Bezpieczny checkout wymaga kompletnej konfiguracji.</strong><p>Zakup personalizowanego projektu jest dostępny wyłącznie wtedy, gdy cennik jest włączony, fason ma cenę bazową i realny produkt katalogowy, a konfiguracja przechodzi reguły zgodności. Stripe nigdy nie korzysta z ceny przesłanej przez przeglądarkę.</p></div>

    <footer className="builder-admin-actions"><button type="button" onClick={save} disabled={busy}>{busy ? "Zapisywanie…" : "Zapisz ustawienia Buildera"}</button>{message && <span>{message}</span>}</footer>
  </section>;
}
