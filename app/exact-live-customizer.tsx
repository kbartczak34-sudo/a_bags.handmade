"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePublicContact, whatsappHref } from "./public-contact";
import { EXACT_ATELIER_LIBRARY, EXACT_ATELIER_SPRITE_PARTS, EXACT_FAMILY_LABELS, type ExactAtelierReference } from "../lib/exact-customizer-library";

const DRAFT_KEY = "abags-exact-customizer-v1";
type FilterKey = "family" | "color" | "stitch" | "flap" | "handles" | "hardware" | "strap" | "accent";
type Filters = Record<FilterKey, string>;
const EMPTY: Filters = { family:"", color:"", stitch:"", flap:"", handles:"", hardware:"", strap:"", accent:"" };

function loadDraft(): Filters {
  if (typeof window === "undefined") return EMPTY;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || "null") as Partial<Filters> | null;
    return parsed ? { ...EMPTY, ...parsed } : EMPTY;
  } catch { return EMPTY; }
}

function matches(ref: ExactAtelierReference, filters: Filters, ignored?: FilterKey) {
  return (Object.keys(filters) as FilterKey[]).every((key) => key === ignored || !filters[key] || ref[key] === filters[key]);
}

function uniqueOptions(candidates: ExactAtelierReference[], key: FilterKey) {
  const seen = new Map<string,string>();
  for (const ref of candidates) {
    const value = ref[key];
    const label = key === "family" ? EXACT_FAMILY_LABELS[ref.family] :
      key === "color" ? ref.colorLabel : key === "stitch" ? ref.stitchLabel : key === "flap" ? ref.flapLabel :
      key === "handles" ? ref.handlesLabel : key === "hardware" ? ref.hardwareLabel : key === "strap" ? ref.strapLabel : ref.accentLabel;
    if (!seen.has(value)) seen.set(value, label);
  }
  return Array.from(seen, ([value,label]) => ({ value,label }));
}

function spriteStyle(ref: ExactAtelierReference, spriteUrl: string) {
  const column = ref.index % 5;
  const row = Math.floor(ref.index / 5);
  return {
    backgroundImage: spriteUrl ? `url(${spriteUrl})` : "none",
    backgroundSize: "500% 400%",
    backgroundPosition: `${column * 25}% ${row * (100 / 3)}%`,
  };
}

export default function ExactLiveCustomizer() {
  const contact = usePublicContact();
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [preview, setPreview] = useState<HTMLElement | null>(null);
  const [filters, setFilters] = useState<Filters>(loadDraft);
  const [selectedId, setSelectedId] = useState("");
  const [showBase, setShowBase] = useState(false);
  const previousSelection = useRef("");
  const [spriteUrl, setSpriteUrl] = useState("");
  const [spriteError, setSpriteError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    Promise.all(EXACT_ATELIER_SPRITE_PARTS.map(async (part) => {
      const response = await fetch(part, { cache: "force-cache" });
      if (!response.ok) throw new Error("Nie udało się wczytać biblioteki 1:1.");
      return response.text();
    })).then((parts) => {
      const encoded = parts.join("").trim();
      const binary = atob(encoded);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      objectUrl = URL.createObjectURL(new Blob([bytes], { type: "image/webp" }));
      if (active) setSpriteUrl(objectUrl);
      else URL.revokeObjectURL(objectUrl);
    }).catch((reason) => {
      if (active) setSpriteError(reason instanceof Error ? reason.message : "Nie udało się wczytać biblioteki 1:1.");
    });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, []);

  useEffect(() => {
    const attach = () => {
      const dialog = document.querySelector<HTMLElement>(".abags-vc-dialog");
      if (!dialog) { setMount(null); setPreview(null); return; }
      let target = dialog.querySelector<HTMLElement>("[data-abags-exact-live]");
      if (!target) {
        target = document.createElement("div");
        target.dataset.abagsExactLive = "true";
        target.className = "abags-exact-live-mount";
        const layout = dialog.querySelector(".abags-vc-layout");
        dialog.insertBefore(target, layout ?? null);
      }
      dialog.classList.add("abags-vc-exact-live-active");
      setMount((current) => current === target ? current : target);
      setPreview((current) => {
        const next = dialog.querySelector<HTMLElement>(".abags-vc-preview");
        return current === next ? current : next;
      });
    };
    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList:true, subtree:true });
    return () => {
      observer.disconnect();
      document.querySelectorAll<HTMLElement>(".abags-vc-dialog.abags-vc-exact-live-active").forEach((dialog) => dialog.classList.remove("abags-vc-exact-live-active"));
    };
  }, []);

  const candidates = useMemo(() => EXACT_ATELIER_LIBRARY.filter((ref) => matches(ref, filters)), [filters]);
  const selected = useMemo(() => {
    if (selectedId) {
      const explicit = candidates.find((ref) => ref.id === selectedId);
      if (explicit) return explicit;
    }
    return candidates[0] ?? EXACT_ATELIER_LIBRARY[0];
  }, [candidates, selectedId]);

  useEffect(() => {
    if (!selected) return;
    if (previousSelection.current !== selected.id) {
      previousSelection.current = selected.id;
      setSelectedId(selected.id);
      setShowBase(false);
    }
  }, [selected]);

  useEffect(() => {
    if (!preview) return;
    preview.classList.toggle("has-exact-reference", !showBase && Boolean(selected));
    return () => preview.classList.remove("has-exact-reference");
  }, [preview, selected, showBase]);

  const setFilter = (key: FilterKey, value: string) => {
    setFilters((current) => {
      const next = { ...current, [key]: value };
      if (EXACT_ATELIER_LIBRARY.some((ref) => matches(ref, next))) return next;
      const retained = { ...EMPTY, [key]: value } as Filters;
      for (const otherKey of Object.keys(current) as FilterKey[]) {
        if (otherKey === key || !current[otherKey]) continue;
        const candidate = { ...retained, [otherKey]: current[otherKey] };
        if (EXACT_ATELIER_LIBRARY.some((ref) => matches(ref, candidate))) retained[otherKey] = current[otherKey];
      }
      return retained;
    });
    setSelectedId("");
    setShowBase(false);
  };

  const optionsFor = (key: FilterKey) => uniqueOptions(EXACT_ATELIER_LIBRARY.filter((ref) => matches(ref, filters, key)), key);
  const reset = () => { setFilters(EMPTY); setSelectedId(""); setShowBase(false); window.localStorage.removeItem(DRAFT_KEY); setSaved(false); };
  const save = () => { window.localStorage.setItem(DRAFT_KEY, JSON.stringify(filters)); setSaved(true); window.setTimeout(() => setSaved(false), 1800); };

  if (!mount || !preview || !selected) return null;

  const fields: Array<[FilterKey,string]> = [
    ["family","Fason"], ["color","Kolor"], ["stitch","Splot / ścieg"], ["flap","Klapa"], ["handles","Uchwyty"], ["hardware","Okucia"], ["strap","Pasek"], ["accent","Detal"],
  ];
  const workshopMessage = `Dzień dobry! Chciałabym zamówić torebkę według projektu z konfiguratora A-Bags. Wzorzec: ${selected.label}. Fason: ${EXACT_FAMILY_LABELS[selected.family]}. Kolor: ${selected.colorLabel}. Splot: ${selected.stitchLabel}. Klapa: ${selected.flapLabel}. Uchwyty: ${selected.handlesLabel}. Okucia: ${selected.hardwareLabel}. Pasek: ${selected.strapLabel}. Detal: ${selected.accentLabel}. Proszę o potwierdzenie możliwości wykonania, finalnej ceny i terminu.`;

  return <>
    {createPortal(<section className="abags-exact-live" aria-labelledby="abags-exact-live-title">
      <div className="abags-exact-live-heading">
        <div><p className="eyebrow">A-Bags Atelier · konfigurator 1:1</p><h3 id="abags-exact-live-title">Twórz swoją torebkę i oglądaj rezultat natychmiast.</h3><p>Wybieraj fason, kolor, splot, klapę, uchwyty, okucia, pasek i detal. Każda zmiana natychmiast przełącza podgląd na zgodny, rzeczywisty wariant z biblioteki A-Bags; niedostępne połączenia są automatycznie wykluczane.</p></div>
        <span>{EXACT_ATELIER_LIBRARY.length} wzorców 1:1</span>
      </div>
      <div className="abags-exact-live-fields">
        {fields.map(([key,label]) => <label key={key}><span>{label}</span><select value={filters[key]} onChange={(event) => setFilter(key, event.target.value)}><option value="">Dowolny zgodny wariant</option>{optionsFor(key).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>)}
      </div>
      <div className="abags-exact-live-result">
        {!spriteUrl && !spriteError && <p className="abags-exact-live-load">Wczytywanie biblioteki zdjęć 1:1…</p>}
        {spriteError && <p className="abags-exact-live-error">{spriteError}</p>}
        <div><strong>Podgląd w czasie rzeczywistym</strong><span>{candidates.length === 1 ? "1 dokładny wariant" : `${candidates.length} zgodnych wariantów`}</span></div>
        <p>{selected.label} · {selected.stitchLabel} · {selected.hardwareLabel}</p>
        <div className="abags-exact-live-variants" aria-label="Zgodne warianty">{candidates.slice(0,8).map((ref) => <button type="button" key={ref.id} className={selected.id === ref.id ? "is-active" : ""} onClick={() => { setSelectedId(ref.id); setShowBase(false); }}><span className="abags-exact-live-sprite" style={spriteStyle(ref, spriteUrl)} aria-hidden="true" /><span>{ref.label}</span></button>)}</div>
      </div>
      <div className="abags-exact-live-actions"><button type="button" onClick={reset}>Wyczyść wybory</button><button type="button" onClick={save}>{saved ? "Zapisano ✓" : "Zapisz projekt"}</button><a href={whatsappHref(contact.whatsappNumber, workshopMessage)} target="_blank" rel="noopener noreferrer">Wyślij projekt do pracowni →</a></div>
    </section>, mount)}
    {createPortal(<>
      {!showBase && spriteUrl && <div className="abags-vc-exact-reference abags-vc-exact-sprite" style={spriteStyle(selected, spriteUrl)} role="img" aria-label={`Podgląd 1:1: ${selected.label}`} />}
      {!showBase && spriteUrl && <div className="abags-vc-exact-reference-badge">Podgląd 1:1 · aktualizowany na żywo</div>}
      <button type="button" className="abags-vc-exact-reference-toggle" onClick={() => setShowBase((current) => !current)}>{showBase ? "Pokaż projekt 1:1" : "Porównaj z modelem bazowym"}</button>
    </>, preview)}
  </>;
}
