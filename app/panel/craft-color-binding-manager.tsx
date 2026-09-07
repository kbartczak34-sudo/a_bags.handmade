"use client";

import { FormEvent, useEffect, useState } from "react";

type Cord = {
  id: string;
  supplier: string;
  supplierSku: string;
  name: string;
  status: "DRAFT" | "MEASURED" | "VALIDATED";
};

type Binding = {
  cordMaterialId: string;
  builderColor: string;
  updatedAt: string;
};

const COLORS = [
  ["#E8DDCC", "Naturalny beż"],
  ["#E4A9B5", "Pudrowy róż"],
  ["#24324D", "Głęboki granat"],
  ["#65493D", "Czekoladowy brąz"],
  ["#C7962F", "Musztardowy"],
  ["#222124", "Czarny"],
  ["#B93A42", "Czerwony"],
  ["#275C4A", "Butelkowa zieleń"],
  ["#087E81", "Turkus"],
  ["#A88AE0", "Lawendowy"],
] as const;

async function loadCords() {
  const response = await fetch("/api/admin/craft-calibration", { cache: "no-store" });
  const payload = await response.json() as { calibration?: { cords?: Cord[] }; error?: string };
  if (!response.ok || !Array.isArray(payload.calibration?.cords)) {
    throw new Error(payload.error || "Nie udało się wczytać materiałów.");
  }
  return payload.calibration.cords.filter((cord) => cord.status === "VALIDATED");
}

async function loadBindings() {
  const response = await fetch("/api/admin/craft-color-bindings", { cache: "no-store" });
  const payload = await response.json() as { bindings?: Binding[]; error?: string };
  if (!response.ok || !Array.isArray(payload.bindings)) {
    throw new Error(payload.error || "Nie udało się wczytać mapowania kolorów.");
  }
  return payload.bindings;
}

export default function CraftColorBindingManager() {
  const [cords, setCords] = useState<Cord[]>([]);
  const [bindings, setBindings] = useState<Binding[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadCords(), loadBindings()])
      .then(([nextCords, nextBindings]) => {
        if (cancelled) return;
        setCords(nextCords);
        setBindings(nextBindings);
      })
      .catch((error) => {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Nie udało się wczytać mapowania kolorów.");
      });
    return () => { cancelled = true; };
  }, []);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const cordMaterialId = String(data.get("cordMaterialId") ?? "");
    const builderColor = String(data.get("builderColor") ?? "");
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/craft-color-bindings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cordMaterialId, builderColor }),
      });
      const payload = await response.json() as { binding?: Binding; error?: string };
      if (!response.ok || !payload.binding) throw new Error(payload.error || "Nie udało się zapisać mapowania koloru.");
      setBindings(await loadBindings());
      setMessage("Powiązanie koloru z fizycznym SKU zapisane ✓");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się zapisać mapowania koloru.");
    } finally {
      setBusy(false);
    }
  };

  return <section className="builder-admin-card" data-craft-color-binding-manager>
    <header className="builder-admin-heading">
      <div>
        <p className="eyebrow">Digital Craft Twin · kolor → materiał</p>
        <h2>Powiąż kolor kreatora z prawdziwym sznurkiem</h2>
        <p>Nie dopasowujemy koloru po nazwie ani „na oko”. Wybierz ręcznie, który zwalidowany SKU sznurka odpowiada konkretnej opcji kolorystycznej widocznej w kreatorze.</p>
      </div>
    </header>

    <div className="builder-admin-note">
      <strong>To powiązanie jest częścią dowodu produkcyjnego.</strong>
      <p>V2 sprawdzi je ponownie przed uznaniem korpusu za BODY_VALIDATED. Jeśli kolor klienta nie odpowiada SKU użytemu w Gauge i Golden Masterze, konfiguracja zostanie zablokowana.</p>
    </div>

    <form className="builder-admin-grid" onSubmit={save}>
      <label>
        <span>Zatwierdzony sznurek</span>
        <select name="cordMaterialId" required defaultValue="">
          <option value="" disabled>Wybierz fizyczny SKU</option>
          {cords.map((cord) => <option key={cord.id} value={cord.id}>{cord.name} · {cord.supplier} · {cord.supplierSku}</option>)}
        </select>
      </label>
      <label>
        <span>Kolor w kreatorze</span>
        <select name="builderColor" required defaultValue="">
          <option value="" disabled>Wybierz kolor</option>
          {COLORS.map(([hex, label]) => <option key={hex} value={hex}>{label} · {hex}</option>)}
        </select>
      </label>
      <button type="submit" disabled={busy || cords.length === 0}>{busy ? "Zapisywanie…" : "Zapisz powiązanie"}</button>
    </form>

    {bindings.length > 0 && <div className="builder-admin-section">
      <h3>Aktywne powiązania</h3>
      {bindings.map((binding) => {
        const cord = cords.find((item) => item.id === binding.cordMaterialId);
        const color = COLORS.find(([hex]) => hex === binding.builderColor);
        return <div className="builder-admin-note" key={binding.cordMaterialId}>
          <strong>{color?.[1] ?? binding.builderColor} → {cord?.name ?? binding.cordMaterialId}</strong>
          <p>{cord ? `${cord.supplier} · ${cord.supplierSku}` : "Materiał nie jest obecnie dostępny na liście zatwierdzonych sznurków."}</p>
        </div>;
      })}
    </div>}

    {message && <footer className="builder-admin-actions"><span>{message}</span></footer>}
  </section>;
}
