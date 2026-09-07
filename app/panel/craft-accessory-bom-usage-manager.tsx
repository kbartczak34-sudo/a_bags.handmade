"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Unit = "PIECE" | "SET" | "METER";
type Binding = {
  id: string;
  slot: string;
  builderValue: string;
  bagFamily: string;
  accessoryId: string;
  mountingProfileId: string;
  status: "DRAFT" | "VALIDATED";
};
type Accessory = { id: string; sku: string; name: string; status: string };
type Usage = { bindingId: string; quantity: number; unit: Unit; status: "DRAFT" | "VALIDATED" };
type Payload = {
  usage?: Usage[];
  bindings?: Binding[];
  accessorySnapshot?: { accessories?: Accessory[] };
  error?: string;
};

const UNIT_LABELS: Record<Unit, string> = {
  PIECE: "szt.",
  SET: "zestaw",
  METER: "m",
};

async function loadData() {
  const response = await fetch("/api/admin/craft-accessory-bom-usage", { cache: "no-store" });
  const payload = await response.json() as Payload;
  if (!response.ok || !Array.isArray(payload.usage) || !Array.isArray(payload.bindings) || !Array.isArray(payload.accessorySnapshot?.accessories)) {
    throw new Error(payload.error || "Nie udało się wczytać zużycia BOM.");
  }
  return {
    usage: payload.usage,
    bindings: payload.bindings,
    accessories: payload.accessorySnapshot.accessories,
  };
}

export default function CraftAccessoryBomUsageManager() {
  const [usage, setUsage] = useState<Usage[]>([]);
  const [bindings, setBindings] = useState<Binding[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [bindingId, setBindingId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const next = await loadData();
    setUsage(next.usage);
    setBindings(next.bindings);
    setAccessories(next.accessories);
  };

  useEffect(() => {
    let cancelled = false;
    void loadData().then((next) => {
      if (cancelled) return;
      setUsage(next.usage);
      setBindings(next.bindings);
      setAccessories(next.accessories);
    }).catch((error) => {
      if (!cancelled) setMessage(error instanceof Error ? error.message : "Nie udało się wczytać zużycia BOM.");
    });
    return () => { cancelled = true; };
  }, []);

  const validatedBindings = useMemo(
    () => bindings.filter((binding) => binding.status === "VALIDATED"),
    [bindings],
  );

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/craft-accessory-bom-usage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bindingId,
          quantity: Number(data.get("quantity")),
          unit: String(data.get("unit") ?? ""),
          status: data.get("approved") === "on" ? "VALIDATED" : "DRAFT",
        }),
      });
      const payload = await response.json() as { usage?: Usage; error?: string };
      if (!response.ok || !payload.usage) throw new Error(payload.error || "Nie udało się zapisać zużycia BOM.");
      await refresh();
      setMessage(payload.usage.status === "VALIDATED" ? "Zużycie BOM zatwierdzone ✓" : "Zużycie BOM zapisane jako szkic.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się zapisać zużycia BOM.");
    } finally {
      setBusy(false);
    }
  };

  return <section className="builder-admin-card" data-craft-accessory-bom-usage-manager>
    <header className="builder-admin-heading">
      <div>
        <p className="eyebrow">Digital Craft Twin · BOM</p>
        <h2>Jawne zużycie fizycznych akcesoriów</h2>
        <p>Określ dokładną ilość i jednostkę dla zatwierdzonego bindingu. System nie zakłada automatycznie, że SKU oznacza jedną sztukę.</p>
      </div>
    </header>

    <div className="builder-admin-note">
      <strong>Brak wartości = brak zatwierdzonego BOM.</strong>
      <p>Jeśli SKU jest kompletnym zestawem okuć, wybierz jednostkę „zestaw”. Jeśli jest elementem ciętym na długość, użyj „m”.</p>
    </div>

    <form className="builder-admin-grid" onSubmit={save}>
      <label><span>Zatwierdzony binding</span><select required value={bindingId} onChange={(event) => setBindingId(event.target.value)}>
        <option value="" disabled>Wybierz opcję → SKU → mocowanie</option>
        {validatedBindings.map((binding) => {
          const accessory = accessories.find((item) => item.id === binding.accessoryId);
          return <option key={binding.id} value={binding.id}>{binding.slot} · {binding.builderValue} · {binding.bagFamily} → {accessory?.sku ?? binding.accessoryId}</option>;
        })}
      </select></label>
      <label><span>Ilość</span><input name="quantity" type="number" min="0.001" step="0.001" required /></label>
      <label><span>Jednostka</span><select name="unit" required defaultValue="PIECE">
        <option value="PIECE">szt.</option><option value="SET">zestaw</option><option value="METER">m</option>
      </select></label>
      <label className="builder-admin-checkbox"><input type="checkbox" name="approved" /><span>Agata potwierdziła tę ilość i jednostkę jako rzeczywiste zużycie BOM</span></label>
      <button type="submit" disabled={busy || !bindingId}>{busy ? "Zapisywanie…" : "Zapisz zużycie BOM"}</button>
    </form>

    {usage.length > 0 && <div className="builder-admin-section">
      <h3>Zatwierdzone i robocze zużycia</h3>
      {usage.map((item) => {
        const binding = bindings.find((candidate) => candidate.id === item.bindingId);
        const accessory = binding ? accessories.find((candidate) => candidate.id === binding.accessoryId) : undefined;
        return <div className="builder-admin-note" key={item.bindingId}>
          <strong>{binding ? `${binding.slot} · ${binding.builderValue} · ${binding.bagFamily}` : item.bindingId}</strong>
          <p>{accessory?.sku ?? "brak SKU"} · {item.quantity} {UNIT_LABELS[item.unit]} · {item.status}</p>
        </div>;
      })}
    </div>}

    {message && <footer className="builder-admin-actions"><span>{message}</span></footer>}
  </section>;
}
