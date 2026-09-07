"use client";

import { useEffect, useMemo, useState } from "react";

type Family = "tote" | "round" | "bucket" | "mini";
type Stitch = "classic" | "herringbone" | "basket" | "shell";
type CoverageCell = { family: Family; stitch: Stitch; status: "NOT_VALIDATED" | "BODY_VALIDATED"; evidenceCount: number; goldenMasterIds: string[] };
type Coverage = { level: "BODY_ONLY"; validatedCells: number; totalCells: number; cells: CoverageCell[]; note: string };

const FAMILIES: Array<[Family, string]> = [
  ["tote", "Kuferek / tote"],
  ["round", "Okrągła"],
  ["bucket", "Z klapą"],
  ["mini", "Strukturalna / mini"],
];
const STITCHES: Array<[Stitch, string]> = [
  ["classic", "Ażurowy V"],
  ["herringbone", "Pionowy ażurowy"],
  ["basket", "Koszykowy"],
  ["shell", "Promienisty"],
];

export default function CraftEvidenceCoverage() {
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/craft-calibration", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { calibration?: { coverage?: Coverage }; error?: string };
        if (!response.ok || !payload.calibration?.coverage) throw new Error(payload.error || "Nie udało się wczytać macierzy pokrycia.");
        return payload.calibration.coverage;
      })
      .then((next) => { if (!cancelled) setCoverage(next); })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Nie udało się wczytać macierzy pokrycia."); });
    return () => { cancelled = true; };
  }, []);

  const byKey = useMemo(() => new Map(coverage?.cells.map((cell) => [`${cell.family}:${cell.stitch}`, cell]) ?? []), [coverage]);

  return <section className="builder-admin-card" data-craft-evidence-coverage>
    <header className="builder-admin-heading">
      <div>
        <p className="eyebrow">Digital Craft Twin · coverage</p>
        <h2>Pokrycie fizycznych wzorców korpusu</h2>
        <p>Ta macierz odpowiada tylko na pytanie, które kombinacje fasonu i ściegu mają pełny zatwierdzony łańcuch materiał → Gauge → Golden Master korpusu.</p>
      </div>
      <div><strong>{coverage ? `${coverage.validatedCells}/${coverage.totalCells}` : "—"}</strong></div>
    </header>

    {error && <div className="builder-admin-note"><p>{error}</p></div>}
    {coverage && <>
      <div className="builder-admin-section">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
            <thead><tr><th style={{ textAlign: "left", padding: "10px" }}>Fason</th>{STITCHES.map(([, label]) => <th key={label} style={{ textAlign: "left", padding: "10px" }}>{label}</th>)}</tr></thead>
            <tbody>{FAMILIES.map(([family, familyLabel]) => <tr key={family}>
              <th scope="row" style={{ textAlign: "left", padding: "10px" }}>{familyLabel}</th>
              {STITCHES.map(([stitch]) => {
                const cell = byKey.get(`${family}:${stitch}`);
                const validated = cell?.status === "BODY_VALIDATED";
                return <td key={stitch} style={{ padding: "10px" }}>
                  <strong>{validated ? "BODY_VALIDATED ✓" : "NOT_VALIDATED"}</strong>
                  <small style={{ display: "block" }}>{validated ? `${cell?.evidenceCount ?? 0} wzorzec/wzorce` : "brak spójnego wzorca"}</small>
                </td>;
              })}
            </tr>)}</tbody>
          </table>
        </div>
      </div>
      <div className="builder-admin-note"><strong>Zakres tego statusu</strong><p>{coverage.note}</p></div>
    </>}
  </section>;
}
