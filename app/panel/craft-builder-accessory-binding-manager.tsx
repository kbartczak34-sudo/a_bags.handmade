"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Status = "DRAFT" | "MEASURED" | "VALIDATED";
type BindingStatus = "DRAFT" | "VALIDATED";
type Slot = "flap" | "handles" | "strap" | "hardware" | "accent";
type Family = "tote" | "round" | "bucket" | "mini";

type Accessory = { id: string; sku: string; kind: string; name: string; material: string; status: Status };
type Mounting = { id: string; accessoryId: string; bagFamily: Family; zone: string; mountingMethod: string; status: Status };
type Binding = { id: string; slot: Slot; builderValue: string; bagFamily: Family; accessoryId: string; mountingProfileId: string; status: BindingStatus };
type Payload = { bindings?: Binding[]; accessorySnapshot?: { accessories?: Accessory[]; mountingProfiles?: Mounting[] }; error?: string };

const SLOT_VALUES: Record<Slot, readonly string[]> = {
  flap: ["crochet", "leather-black", "leather-cognac", "suede-burgundy"],
  handles: ["wood-light", "wood-dark", "crochet"],
  strap: ["leather", "woven", "chain"],
  hardware: ["gold", "silver", "black"],
  accent: ["tassel", "scarf", "charm"],
};

const FAMILIES: Family[] = ["tote", "round", "bucket", "mini"];

async function loadData() {
  const response = await fetch("/api/admin/craft-builder-accessory-bindings", { cache: "no-store" });
  const payload = await response.json() as Payload;
  if (!response.ok || !Array.isArray(payload.bindings) || !Array.isArray(payload.accessorySnapshot?.accessories) || !Array.isArray(payload.accessorySnapshot?.mountingProfiles)) {
    throw new Error(payload.error || "Nie udało się wczytać bindingów akcesoriów.");
  }
  return {
    bindings: payload.bindings,
    accessories: payload.accessorySnapshot.accessories,
    mountings: payload.accessorySnapshot.mountingProfiles,
  };
}

export default function CraftBuilderAccessoryBindingManager() {
  const [bindings, setBindings] = useState<Binding[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [mountings, setMountings] = useState<Mounting[]>([]);
  const [slot, setSlot] = useState<Slot>("flap");
  const [family, setFamily] = useState<Family>("tote");
  const [accessoryId, setAccessoryId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const next = await loadData();
    setBindings(next.bindings);
    setAccessories(next.accessories);
    setMountings(next.mountings);
  };

  useEffect(() => {
    let cancelled = false;
    void loadData().then((next) => {
      if (cancelled) return;
      setBindings(next.bindings);
      setAccessories(next.accessories);
      setMountings(next.mountings);
    }).catch((error) => {
      if (!cancelled) setMessage(error instanceof Error ? error.message : "Nie udało się wczytać bindingów.");
    });
    return () => { cancelled = true; };
  }, []);

  const availableMountings = useMemo(
    () => mountings.filter((item) => item.accessoryId === accessoryId && item.bagFamily === family),
    [accessoryId, family, mountings],
  );

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/craft-builder-accessory-bindings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slot,
          builderValue: String(data.get("builderValue") ?? ""),
          bagFamily: family,
          accessoryId,
          mountingProfileId: String(data.get("mountingProfileId") ?? ""),
          status: data.get("approved") === "on" ? "VALIDATED" : "DRAFT",
        }),
      });
      const payload = await response.json() as { binding?: Binding; error?: string };
      if (!response.ok || !payload.binding) throw new Error(payload.error || "Nie udało się zapisać bindingu.");
      await refresh();
      setMessage(payload.binding.status === "VALIDATED" ? "Binding produkcyjny zatwierdzony ✓" : "Binding zapisany jako szkic.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się zapisać bindingu.");
    } finally {
      setBusy(false);
    }
  };

  return <section className="builder-admin-card" data-craft-builder-accessory-binding-manager>
    <header className="builder-admin-heading">
      <div>
        <p className="eyebrow">Digital Craft Twin · opcja → SKU → mocowanie</p>
        <h2>Powiąż opcje kreatora z fizycznymi akcesoriami</h2>
        <p>Każda opcja klienta musi wskazywać konkretne SKU i profil mocowania dla danego fasonu. System nie dopasowuje akcesoriów po nazwie ani wyglądzie.</p>
      </div>
    </header>

    <div className="builder-admin-note">
      <strong>`none` nie wymaga sztucznego SKU.</strong>
      <p>Binding VALIDATED jest możliwy dopiero, gdy zarówno akcesorium, jak i jego profil mocowania są fizycznie zatwierdzone.</p>
    </div>

    <form className="builder-admin-grid" onSubmit={save}>
      <label><span>Slot kreatora</span><select value={slot} onChange={(event) => { setSlot(event.target.value as Slot); setAccessoryId(""); }}>
        <option value="flap">Klapa</option><option value="handles">Uchwyt</option><option value="strap">Pasek</option><option value="hardware">Okucia</option><option value="accent">Dekoracja</option>
      </select></label>
      <label><span>Opcja klienta</span><select name="builderValue" required>{SLOT_VALUES[slot].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label><span>Fason</span><select value={family} onChange={(event) => setFamily(event.target.value as Family)}>{FAMILIES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label><span>Fizyczne SKU</span><select required value={accessoryId} onChange={(event) => setAccessoryId(event.target.value)}>
        <option value="" disabled>Wybierz zmierzone akcesorium</option>
        {accessories.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.sku} · {item.status}</option>)}
      </select></label>
      <label><span>Profil mocowania</span><select name="mountingProfileId" required defaultValue="" key={`${accessoryId}:${family}`}>
        <option value="" disabled>Wybierz profil dla tego SKU i fasonu</option>
        {availableMountings.map((item) => <option key={item.id} value={item.id}>{item.zone} · {item.mountingMethod} · {item.status}</option>)}
      </select></label>
      <label className="builder-admin-checkbox"><input type="checkbox" name="approved" /><span>Agata zatwierdziła ten binding jako dokładne odwzorowanie opcji klienta</span></label>
      <button type="submit" disabled={busy || !accessoryId || availableMountings.length === 0}>{busy ? "Zapisywanie…" : "Zapisz binding"}</button>
    </form>

    {bindings.length > 0 && <div className="builder-admin-section">
      <h3>Zapisane bindingi</h3>
      {bindings.map((binding) => {
        const accessory = accessories.find((item) => item.id === binding.accessoryId);
        const mounting = mountings.find((item) => item.id === binding.mountingProfileId);
        return <div className="builder-admin-note" key={binding.id}>
          <strong>{binding.slot} · {binding.builderValue} · {binding.bagFamily} → {accessory?.sku ?? binding.accessoryId}</strong>
          <p>{binding.status} · {accessory?.name ?? "brak akcesorium"} · {mounting ? `${mounting.zone} / ${mounting.mountingMethod}` : "brak profilu mocowania"}</p>
        </div>;
      })}
    </div>}

    {message && <footer className="builder-admin-actions"><span>{message}</span></footer>}
  </section>;
}
