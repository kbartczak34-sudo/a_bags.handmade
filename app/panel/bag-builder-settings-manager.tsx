"use client";

import { useEffect, useState } from "react";

type Settings = {
  pricingEnabled: boolean;
  familyBaseCents: Record<"tote" | "round" | "bucket" | "mini", number | null>;
  stitchCents: Record<"classic" | "herringbone" | "basket" | "shell", number>;
  flapCents: Record<"none" | "crochet" | "leather-black" | "leather-cognac" | "suede-burgundy", number>;
  handlesCents: Record<"none" | "wood-light" | "wood-dark" | "crochet", number>;
  strapCents: Record<"none" | "leather" | "woven" | "chain", number>;
  hardwareCents: Record<"gold" | "silver" | "black", number>;
  accentCents: Record<"none" | "tassel" | "scarf" | "charm", number>;
  compatibility: {
    handles: Record<"tote" | "round" | "bucket" | "mini", string[]>;
    straps: Record<"tote" | "round" | "bucket" | "mini", string[]>;
    flaps: Record<"tote" | "round" | "bucket" | "mini", string[]>;
  };
  updatedAt?: string | null;
};

const FAMILY_LABELS = { tote: "Prostokątna", round: "Półokrągła", bucket: "Kubełkowa", mini: "Mini" } as const;
const PRICE_GROUPS = [
  ["stitchCents", "Splot", { classic: "Klasyczny", herringbone: "Jodełka", basket: "Koszykowy", shell: "Muszla" }],
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

export default function BagBuilderSettingsManager() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/bag-builder-settings", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { settings?: Settings; error?: string };
        if (!response.ok || !payload.settings) throw new Error(payload.error || "Nie udało się wczytać ustawień.");
        setSettings(payload.settings);
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
      <div><p className="eyebrow">Bag Builder · sprzedaż</p><h2>Cena na żywo i kompatybilność</h2><p>Ustawiaj prawdziwe ceny bez zmiany kodu. Dopóki nie włączysz cennika, klient nadal zobaczy bezpieczną informację o wycenie indywidualnej.</p></div>
      <label className="builder-admin-switch"><input type="checkbox" checked={settings.pricingEnabled} onChange={(event) => setSettings({ ...settings, pricingEnabled: event.currentTarget.checked })} /><span>Włącz cenę na żywo</span></label>
    </header>

    <div className="builder-admin-section"><h3>Cena bazowa fasonu</h3><div className="builder-admin-grid">{Object.entries(FAMILY_LABELS).map(([key, text]) => <label key={key}><span>{text}</span><div><input inputMode="decimal" value={toPln(settings.familyBaseCents[key as keyof typeof FAMILY_LABELS])} placeholder="np. 249,00" onChange={(event) => setSettings({ ...settings, familyBaseCents: { ...settings.familyBaseCents, [key]: event.currentTarget.value.trim() ? fromPln(event.currentTarget.value) : null } })} /><em>zł</em></div></label>)}</div></div>

    <div className="builder-admin-section"><h3>Dopłaty do opcji</h3>{PRICE_GROUPS.map(([groupKey, title, labels]) => <div className="builder-admin-price-group" key={groupKey}><strong>{title}</strong><div className="builder-admin-grid">{Object.entries(labels).map(([key, text]) => <label key={key}><span>{text}</span><div><input inputMode="decimal" value={toPln((settings[groupKey] as Record<string, number>)[key] ?? 0)} onChange={(event) => setSettings({ ...settings, [groupKey]: { ...(settings[groupKey] as Record<string, number>), [key]: fromPln(event.currentTarget.value) } })} /><em>zł</em></div></label>)}</div></div>)}</div>

    <div className="builder-admin-note"><strong>Reguły zgodności są aktywne.</strong><p>Fason półokrągły i Mini blokują drewniane uchwyty, zgodnie z obecną logiką konstrukcji. Pozostałe opcje pozostają dostępne, dopóki nie zdefiniujesz bardziej szczegółowych zasad wykonania.</p></div>

    <footer className="builder-admin-actions"><button type="button" onClick={save} disabled={busy}>{busy ? "Zapisywanie…" : "Zapisz ustawienia Buildera"}</button>{message && <span>{message}</span>}</footer>
  </section>;
}
