"use client";

import { FormEvent, useEffect, useState } from "react";

type Status = "DRAFT" | "MEASURED" | "VALIDATED";
type Cord = { id: string; supplier: string; supplierSku: string; name: string; nominalDiameterMm: number; measuredDiameterMm: number | null; status: Status };
type Gauge = { id: string; cordMaterialId: string; stitchPatternId: string; hookSizeMm: number; sampleStitches: number; sampleRows: number; sampleWidthMm: number; sampleHeightMm: number; status: Status };
type GoldenMaster = { id: string; bagFamily: string; stitchPatternId: string; widthMm: number; heightMm: number; depthMm: number; status: Status };
type Calibration = {
  cords: Cord[];
  gauges: Gauge[];
  goldenMasters: GoldenMaster[];
  readiness: { status: "NOT_VALIDATED" | "VALIDATED"; cordsValidated: number; gaugesValidated: number; goldenMastersValidated: number; reasons: string[] };
};

const STITCHES = [
  ["classic", "Ażurowy V"],
  ["herringbone", "Pionowy ażurowy"],
  ["basket", "Koszykowy"],
  ["shell", "Promienisty"],
] as const;
const FAMILIES = [
  ["tote", "Kuferek / tote"],
  ["round", "Okrągła"],
  ["bucket", "Z klapą"],
  ["mini", "Strukturalna / mini"],
] as const;

function num(form: FormData, name: string) {
  const value = String(form.get(name) ?? "").replace(",", ".").trim();
  return value ? Number(value) : null;
}

function str(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

async function fetchCalibration() {
  const response = await fetch("/api/admin/craft-calibration", { cache: "no-store" });
  const payload = await response.json() as { calibration?: Calibration; error?: string };
  if (!response.ok || !payload.calibration) throw new Error(payload.error || "Nie udało się wczytać laboratorium.");
  return payload.calibration;
}

async function postRecord(kind: string, data: Record<string, unknown>) {
  const response = await fetch("/api/admin/craft-calibration", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, data }),
  });
  const payload = await response.json() as { error?: string };
  if (!response.ok) throw new Error(payload.error || "Nie udało się zapisać kalibracji.");
}

export default function CraftCalibrationManager() {
  const [calibration, setCalibration] = useState<Calibration | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchCalibration()
      .then((next) => { if (!cancelled) setCalibration(next); })
      .catch((error) => { if (!cancelled) setMessage(error instanceof Error ? error.message : "Nie udało się wczytać laboratorium."); });
    return () => { cancelled = true; };
  }, []);

  const submit = async (kind: string, data: Record<string, unknown>, form: HTMLFormElement) => {
    setBusy(true);
    setMessage("");
    try {
      await postRecord(kind, data);
      form.reset();
      setCalibration(await fetchCalibration());
      setMessage("Pomiar zapisany ✓");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się zapisać pomiaru.");
    } finally {
      setBusy(false);
    }
  };

  const saveCord = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    void submit("cord", {
      supplier: str(data, "supplier"),
      supplierSku: str(data, "supplierSku"),
      name: str(data, "name"),
      nominalDiameterMm: num(data, "nominalDiameterMm"),
      measuredDiameterMm: num(data, "measuredDiameterMm"),
      metersPerSpool: num(data, "metersPerSpool"),
      gramsPerMeter: num(data, "gramsPerMeter"),
      purchasePriceCents: (() => { const value = num(data, "purchasePricePln"); return value === null ? null : Math.round(value * 100); })(),
      status: data.get("validated") === "on" ? "VALIDATED" : "DRAFT",
    }, form);
  };

  const saveGauge = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const cordMeters = num(data, "cordUsedMeters");
    void submit("gauge", {
      cordMaterialId: str(data, "cordMaterialId"),
      stitchPatternId: str(data, "stitchPatternId"),
      hookSizeMm: num(data, "hookSizeMm"),
      tensionProfileId: str(data, "tensionProfileId"),
      sampleStitches: num(data, "sampleStitches"),
      sampleRows: num(data, "sampleRows"),
      sampleWidthMm: num(data, "sampleWidthMm"),
      sampleHeightMm: num(data, "sampleHeightMm"),
      cordUsedMm: cordMeters === null ? null : cordMeters * 1000,
      finishedThicknessMm: num(data, "finishedThicknessMm"),
      status: data.get("validated") === "on" ? "VALIDATED" : "MEASURED",
    }, form);
  };

  const saveMaster = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const cordMeters = num(data, "actualCordUsedMeters");
    const gaugeId = str(data, "gaugeProfileId");
    const gauge = calibration?.gauges.find((item) => item.id === gaugeId);
    void submit("golden-master", {
      bagFamily: str(data, "bagFamily"),
      productId: str(data, "productId") || null,
      cordMaterialId: gauge?.cordMaterialId ?? "",
      gaugeProfileId: gaugeId,
      stitchPatternId: gauge?.stitchPatternId ?? str(data, "stitchPatternId"),
      widthMm: num(data, "widthMm"),
      heightMm: num(data, "heightMm"),
      depthMm: num(data, "depthMm"),
      stitchCount: num(data, "stitchCount"),
      rowCount: num(data, "rowCount"),
      actualCordUsedMm: cordMeters === null ? null : cordMeters * 1000,
      actualMassG: num(data, "actualMassG"),
      notes: str(data, "notes"),
      status: data.get("validated") === "on" ? "VALIDATED" : "MEASURED",
    }, form);
  };

  if (!calibration) return <section className="builder-admin-card"><p>{message || "Wczytywanie Laboratorium rzemiosła…"}</p></section>;

  return <section className="builder-admin-card" data-craft-calibration-manager>
    <header className="builder-admin-heading">
      <div>
        <p className="eyebrow">Digital Craft Twin · kalibracja fizyczna</p>
        <h2>Laboratorium rzemiosła</h2>
        <p>Wpisuj wyłącznie pomiary wykonane na prawdziwych materiałach i torebkach Agaty. System nie uzupełnia brakujących wartości i nie generuje danych „na oko”.</p>
      </div>
      <div><strong>{calibration.readiness.status === "VALIDATED" ? "Kalibracja bazowa ✓" : "NOT_VALIDATED"}</strong></div>
    </header>

    <div className="builder-admin-note">
      <strong>Łańcuch dowodowy 1:1</strong>
      <p>Zatwierdzony sznurek → zatwierdzona próbka Gauge → zatwierdzony Golden Master. Brak dowolnego etapu oznacza brak fizycznej walidacji.</p>
      <p>Zweryfikowane: materiały {calibration.readiness.cordsValidated} · Gauge {calibration.readiness.gaugesValidated} · Golden Master {calibration.readiness.goldenMastersValidated}</p>
      {calibration.readiness.reasons.map((reason) => <p key={reason}>• {reason}</p>)}
    </div>

    <div className="builder-admin-section">
      <h3>1. Materiał / sznurek</h3>
      <form className="builder-admin-grid" onSubmit={saveCord}>
        <label><span>Dostawca</span><input name="supplier" required placeholder="np. Pimiotki" /></label>
        <label><span>SKU dostawcy</span><input name="supplierSku" required placeholder="dokładny kod z etykiety" /></label>
        <label><span>Nazwa / kolor handlowy</span><input name="name" required /></label>
        <label><span>Średnica nominalna [mm]</span><input name="nominalDiameterMm" inputMode="decimal" required /></label>
        <label><span>Średnica zmierzona [mm]</span><input name="measuredDiameterMm" inputMode="decimal" /></label>
        <label><span>Długość nawoju [m]</span><input name="metersPerSpool" inputMode="decimal" /></label>
        <label><span>Masa na metr [g/m]</span><input name="gramsPerMeter" inputMode="decimal" /></label>
        <label><span>Cena nawoju [zł]</span><input name="purchasePricePln" inputMode="decimal" /></label>
        <label><span><input type="checkbox" name="validated" /> Agata zatwierdziła komplet pomiarów materiału</span></label>
        <button type="submit" disabled={busy}>Zapisz materiał</button>
      </form>
      {calibration.cords.map((cord) => <div className="builder-admin-note" key={cord.id}><strong>{cord.name} · {cord.supplierSku}</strong><p>{cord.supplier} · nominalnie {cord.nominalDiameterMm} mm · pomiar {cord.measuredDiameterMm ?? "—"} mm · {cord.status}</p></div>)}
    </div>

    <div className="builder-admin-section">
      <h3>2. Próbka Gauge</h3>
      <p>Wymiary i zużycie mają pochodzić z jednej rzeczywistej próbki wykonanej konkretnym sznurkiem, ściegiem, szydełkiem i napięciem.</p>
      <form className="builder-admin-grid" onSubmit={saveGauge}>
        <label><span>Materiał</span><select name="cordMaterialId" required defaultValue=""><option value="" disabled>Wybierz sznurek</option>{calibration.cords.map((cord) => <option key={cord.id} value={cord.id}>{cord.name} · {cord.supplierSku} · {cord.status}</option>)}</select></label>
        <label><span>Ścieg</span><select name="stitchPatternId" required defaultValue=""><option value="" disabled>Wybierz ścieg</option>{STITCHES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label><span>Szydełko [mm]</span><input name="hookSizeMm" inputMode="decimal" required /></label>
        <label><span>Profil napięcia / kod próbki</span><input name="tensionProfileId" required placeholder="np. próbka z etykiety Agaty" /></label>
        <label><span>Liczba oczek próbki</span><input name="sampleStitches" inputMode="numeric" required /></label>
        <label><span>Liczba rzędów próbki</span><input name="sampleRows" inputMode="numeric" required /></label>
        <label><span>Szerokość próbki [mm]</span><input name="sampleWidthMm" inputMode="decimal" required /></label>
        <label><span>Wysokość próbki [mm]</span><input name="sampleHeightMm" inputMode="decimal" required /></label>
        <label><span>Zużyty sznurek [m]</span><input name="cordUsedMeters" inputMode="decimal" required /></label>
        <label><span>Grubość gotowej próbki [mm]</span><input name="finishedThicknessMm" inputMode="decimal" /></label>
        <label><span><input type="checkbox" name="validated" /> Agata zatwierdziła tę próbkę Gauge</span></label>
        <button type="submit" disabled={busy || calibration.cords.length === 0}>Zapisz Gauge</button>
      </form>
      {calibration.gauges.map((gauge) => <div className="builder-admin-note" key={gauge.id}><strong>{gauge.stitchPatternId} · szydełko {gauge.hookSizeMm} mm</strong><p>{gauge.sampleStitches} oczek × {gauge.sampleRows} rzędów → {gauge.sampleWidthMm} × {gauge.sampleHeightMm} mm · {gauge.status}</p></div>)}
    </div>

    <div className="builder-admin-section">
      <h3>3. Golden Master — prawdziwa torebka referencyjna</h3>
      <form className="builder-admin-grid" onSubmit={saveMaster}>
        <label><span>Fason</span><select name="bagFamily" required defaultValue=""><option value="" disabled>Wybierz fason</option>{FAMILIES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label><span>ID produktu katalogowego (opcjonalnie)</span><input name="productId" /></label>
        <label><span>Zweryfikowany Gauge</span><select name="gaugeProfileId" required defaultValue=""><option value="" disabled>Wybierz Gauge</option>{calibration.gauges.map((gauge) => <option key={gauge.id} value={gauge.id}>{gauge.stitchPatternId} · {gauge.status}</option>)}</select></label>
        <label><span>Szerokość gotowej torebki [mm]</span><input name="widthMm" inputMode="decimal" required /></label>
        <label><span>Wysokość gotowej torebki [mm]</span><input name="heightMm" inputMode="decimal" required /></label>
        <label><span>Głębokość gotowej torebki [mm]</span><input name="depthMm" inputMode="decimal" required /></label>
        <label><span>Liczba oczek (jeśli konstrukcja ma stałą)</span><input name="stitchCount" inputMode="numeric" /></label>
        <label><span>Liczba rzędów (jeśli konstrukcja ma stałą)</span><input name="rowCount" inputMode="numeric" /></label>
        <label><span>Rzeczywiste zużycie sznurka [m]</span><input name="actualCordUsedMeters" inputMode="decimal" required /></label>
        <label><span>Rzeczywista masa gotowej torebki [g]</span><input name="actualMassG" inputMode="decimal" required /></label>
        <label><span>Notatki produkcyjne</span><textarea name="notes" rows={3} /></label>
        <label><span><input type="checkbox" name="validated" /> Agata zatwierdziła Golden Master jako wzorzec 1:1</span></label>
        <button type="submit" disabled={busy || calibration.gauges.length === 0}>Zapisz Golden Master</button>
      </form>
      {calibration.goldenMasters.map((master) => <div className="builder-admin-note" key={master.id}><strong>{master.bagFamily} · {master.stitchPatternId}</strong><p>{master.widthMm} × {master.heightMm} × {master.depthMm} mm · {master.status}</p></div>)}
    </div>

    {message && <footer className="builder-admin-actions"><span>{message}</span></footer>}
  </section>;
}
