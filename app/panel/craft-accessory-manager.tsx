"use client";

import { FormEvent, useEffect, useState } from "react";

type Status = "DRAFT" | "MEASURED" | "VALIDATED";
type Accessory = {
  id: string;
  sku: string;
  kind: "FLAP" | "HANDLE" | "STRAP" | "HARDWARE" | "ACCENT" | "CLOSURE";
  name: string;
  material: string;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  thicknessMm: number | null;
  massG: number | null;
  status: Status;
};
type Mounting = {
  id: string;
  accessoryId: string;
  bagFamily: string;
  zone: string;
  mountingMethod: string;
  anchorCount: number;
  minEdgeClearanceMm: number;
  validatedLoadN: number | null;
  status: Status;
};
type Snapshot = {
  accessories: Accessory[];
  mountingProfiles: Mounting[];
  readiness: { status: "NOT_VALIDATED" | "VALIDATED"; accessoriesValidated: number; mountingsValidated: number; reasons: string[] };
};

const KINDS = [
  ["FLAP", "Klapa"],
  ["HANDLE", "Uchwyt"],
  ["STRAP", "Pasek / łańcuszek"],
  ["HARDWARE", "Okucie"],
  ["ACCENT", "Ozdoba"],
  ["CLOSURE", "Zapięcie"],
] as const;
const FAMILIES = [
  ["tote", "Kuferek / tote"],
  ["round", "Okrągła"],
  ["bucket", "Z klapą"],
  ["mini", "Strukturalna / mini"],
] as const;

function number(form: FormData, name: string) {
  const raw = String(form.get(name) ?? "").replace(",", ".").trim();
  return raw ? Number(raw) : null;
}

async function loadSnapshot() {
  const response = await fetch("/api/admin/craft-accessories", { cache: "no-store" });
  const payload = await response.json() as { accessories?: Snapshot; error?: string };
  if (!response.ok || !payload.accessories) throw new Error(payload.error || "Nie udało się wczytać profili akcesoriów.");
  return payload.accessories;
}

async function post(kind: "accessory" | "mounting", data: Record<string, unknown>) {
  const response = await fetch("/api/admin/craft-accessories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, data }),
  });
  const payload = await response.json() as { error?: string };
  if (!response.ok) throw new Error(payload.error || "Nie udało się zapisać profilu.");
}

export default function CraftAccessoryManager() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadSnapshot()
      .then((next) => { if (!cancelled) setSnapshot(next); })
      .catch((error) => { if (!cancelled) setMessage(error instanceof Error ? error.message : "Nie udało się wczytać profili."); });
    return () => { cancelled = true; };
  }, []);

  const refresh = async () => setSnapshot(await loadSnapshot());

  const saveAccessory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setMessage("");
    try {
      await post("accessory", {
        sku: String(data.get("sku") ?? "").trim(),
        kind: String(data.get("kind") ?? ""),
        name: String(data.get("name") ?? "").trim(),
        material: String(data.get("material") ?? "").trim(),
        lengthMm: number(data, "lengthMm"),
        widthMm: number(data, "widthMm"),
        heightMm: number(data, "heightMm"),
        thicknessMm: number(data, "thicknessMm"),
        massG: number(data, "massG"),
        status: data.get("validated") === "on" ? "VALIDATED" : "MEASURED",
      });
      form.reset();
      await refresh();
      setMessage("Fizyczny profil akcesorium zapisany ✓");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się zapisać akcesorium.");
    } finally {
      setBusy(false);
    }
  };

  const saveMounting = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setMessage("");
    try {
      await post("mounting", {
        accessoryId: String(data.get("accessoryId") ?? ""),
        bagFamily: String(data.get("bagFamily") ?? ""),
        zone: String(data.get("zone") ?? "").trim(),
        mountingMethod: String(data.get("mountingMethod") ?? "").trim(),
        anchorCount: number(data, "anchorCount"),
        holeSpacingMm: number(data, "holeSpacingMm"),
        minEdgeClearanceMm: number(data, "minEdgeClearanceMm"),
        requiresReinforcement: data.get("requiresReinforcement") === "on",
        validatedLoadN: number(data, "validatedLoadN"),
        status: data.get("validated") === "on" ? "VALIDATED" : "MEASURED",
      });
      form.reset();
      await refresh();
      setMessage("Profil mocowania zapisany ✓");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się zapisać mocowania.");
    } finally {
      setBusy(false);
    }
  };

  if (!snapshot) return <section className="builder-admin-card"><p>{message || "Wczytywanie laboratorium akcesoriów…"}</p></section>;

  return <section className="builder-admin-card" data-craft-accessory-manager>
    <header className="builder-admin-heading">
      <div>
        <p className="eyebrow">Digital Craft Twin · akcesoria i mocowania</p>
        <h2>Laboratorium akcesoriów</h2>
        <p>Dodawaj wyłącznie rzeczywiste akcesoria oraz pomiary ich montażu. System nie wstawia domyślnych wymiarów, masy ani nośności.</p>
      </div>
      <strong>{snapshot.readiness.status}</strong>
    </header>

    <div className="builder-admin-note">
      <strong>Akcesorium i mocowanie są dwoma osobnymi dowodami.</strong>
      <p>Profil akcesorium opisuje fizyczny SKU. Profil mocowania opisuje sposób zamocowania go do konkretnego fasonu. Uchwyt i pasek wymagają zmierzonej nośności przed zatwierdzeniem mocowania.</p>
      <p>Zatwierdzone: akcesoria {snapshot.readiness.accessoriesValidated} · mocowania {snapshot.readiness.mountingsValidated}</p>
    </div>

    <div className="builder-admin-section">
      <h3>1. Fizyczny profil akcesorium</h3>
      <form className="builder-admin-grid" onSubmit={saveAccessory}>
        <label><span>SKU / kod elementu</span><input name="sku" required /></label>
        <label><span>Typ</span><select name="kind" required defaultValue=""><option value="" disabled>Wybierz typ</option>{KINDS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label><span>Nazwa</span><input name="name" required /></label>
        <label><span>Materiał</span><input name="material" required placeholder="np. skóra, drewno, stal" /></label>
        <label><span>Długość [mm]</span><input name="lengthMm" inputMode="decimal" /></label>
        <label><span>Szerokość [mm]</span><input name="widthMm" inputMode="decimal" /></label>
        <label><span>Wysokość [mm]</span><input name="heightMm" inputMode="decimal" /></label>
        <label><span>Grubość [mm]</span><input name="thicknessMm" inputMode="decimal" /></label>
        <label><span>Masa [g]</span><input name="massG" inputMode="decimal" /></label>
        <label><span><input type="checkbox" name="validated" /> Agata zatwierdziła pomiary tego fizycznego SKU</span></label>
        <button type="submit" disabled={busy}>Zapisz akcesorium</button>
      </form>
      {snapshot.accessories.map((item) => <div className="builder-admin-note" key={item.id}><strong>{item.name} · {item.sku}</strong><p>{item.kind} · {item.material} · masa {item.massG ?? "—"} g · {item.status}</p></div>)}
    </div>

    <div className="builder-admin-section">
      <h3>2. Fizyczny profil mocowania</h3>
      <form className="builder-admin-grid" onSubmit={saveMounting}>
        <label><span>Akcesorium</span><select name="accessoryId" required defaultValue=""><option value="" disabled>Wybierz SKU</option>{snapshot.accessories.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.sku} · {item.status}</option>)}</select></label>
        <label><span>Fason</span><select name="bagFamily" required defaultValue=""><option value="" disabled>Wybierz fason</option>{FAMILIES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label><span>Strefa montażu</span><input name="zone" required placeholder="np. bok, górna krawędź, klapa" /></label>
        <label><span>Metoda montażu</span><input name="mountingMethod" required placeholder="rzeczywista metoda Agaty" /></label>
        <label><span>Liczba punktów mocowania</span><input name="anchorCount" inputMode="numeric" required /></label>
        <label><span>Rozstaw otworów [mm] (jeśli dotyczy)</span><input name="holeSpacingMm" inputMode="decimal" /></label>
        <label><span>Minimalny odstęp od krawędzi [mm]</span><input name="minEdgeClearanceMm" inputMode="decimal" required /></label>
        <label><span>Nośność z testu [N] (wymagana dla uchwytu/paska)</span><input name="validatedLoadN" inputMode="decimal" /></label>
        <label><span><input type="checkbox" name="requiresReinforcement" /> Wymaga wzmocnienia</span></label>
        <label><span><input type="checkbox" name="validated" /> Agata zatwierdziła ten profil mocowania</span></label>
        <button type="submit" disabled={busy || snapshot.accessories.length === 0}>Zapisz mocowanie</button>
      </form>
      {snapshot.mountingProfiles.map((item) => {
        const accessory = snapshot.accessories.find((candidate) => candidate.id === item.accessoryId);
        return <div className="builder-admin-note" key={item.id}><strong>{accessory?.name ?? item.accessoryId} · {item.bagFamily}</strong><p>{item.zone} · {item.mountingMethod} · {item.anchorCount} punkty · nośność {item.validatedLoadN ?? "—"} N · {item.status}</p></div>;
      })}
    </div>

    {message && <footer className="builder-admin-actions"><span>{message}</span></footer>}
  </section>;
}
