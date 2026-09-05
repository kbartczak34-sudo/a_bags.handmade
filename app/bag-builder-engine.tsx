"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { usePublicContact, whatsappHref } from "./public-contact";

const DRAFT_KEY = "abags-bag-builder-v3";

type Family = "" | "tote" | "round" | "bucket" | "mini";
type Stitch = "" | "classic" | "herringbone" | "basket" | "shell";
type Flap = "none" | "crochet" | "leather-black" | "leather-cognac" | "suede-burgundy";
type Handles = "none" | "wood-light" | "wood-dark" | "crochet";
type Strap = "none" | "leather" | "woven" | "chain";
type Hardware = "gold" | "silver" | "black";
type Accent = "none" | "tassel" | "scarf" | "charm";

export type BagBuilderConfig = {
  family: Family;
  color: string;
  stitch: Stitch;
  flap: Flap;
  handles: Handles;
  strap: Strap;
  hardware: Hardware;
  accent: Accent;
};

type Option<T extends string> = { value: T; label: string; description?: string; swatch?: string };

const EMPTY: BagBuilderConfig = {
  family: "",
  color: "",
  stitch: "",
  flap: "none",
  handles: "none",
  strap: "none",
  hardware: "gold",
  accent: "none",
};

const FAMILIES: Option<Family>[] = [
  { value: "tote", label: "Kuferek / tote", description: "Fason kalibrowany do rzeczywistych kuferków Agaty" },
  { value: "round", label: "Okrągła", description: "Okrągły fason Agaty z promienistym prowadzeniem ściegu" },
  { value: "bucket", label: "Z klapą", description: "Zwarty fason Agaty przygotowany pod klapę i pasek" },
  { value: "mini", label: "Strukturalna / mini", description: "Kompaktowy fason Agaty o uporządkowanych proporcjach" },
];

const COLORS: Option<string>[] = [
  { value: "#E8DDCC", label: "Naturalny beż", swatch: "#E8DDCC" },
  { value: "#E4A9B5", label: "Pudrowy róż", swatch: "#E4A9B5" },
  { value: "#24324D", label: "Głęboki granat", swatch: "#24324D" },
  { value: "#65493D", label: "Czekoladowy brąz", swatch: "#65493D" },
  { value: "#C7962F", label: "Musztardowy", swatch: "#C7962F" },
  { value: "#222124", label: "Czarny", swatch: "#222124" },
  { value: "#B93A42", label: "Czerwony", swatch: "#B93A42" },
  { value: "#275C4A", label: "Butelkowa zieleń", swatch: "#275C4A" },
  { value: "#087E81", label: "Turkus", swatch: "#087E81" },
  { value: "#A88AE0", label: "Lawendowy", swatch: "#A88AE0" },
];

const STITCHES: Option<Stitch>[] = [
  { value: "classic", label: "Ażurowy V", description: "Szydełkowy rytm V z otwartymi prześwitami" },
  { value: "herringbone", label: "Pionowy ażurowy", description: "Szydełkowy rytm wydłużonych pionowych kolumn" },
  { value: "basket", label: "Koszykowy", description: "Gęstsza szydełkowa struktura oczek" },
  { value: "shell", label: "Promienisty", description: "Szydełkowy rytm wachlarzy prowadzony promieniście" },
];

const FLAPS: Option<Flap>[] = [
  { value: "none", label: "Bez klapy" },
  { value: "crochet", label: "Szydełkowa", description: "W kolorze korpusu" },
  { value: "leather-black", label: "Skórzana czarna" },
  { value: "leather-cognac", label: "Skórzana koniak" },
  { value: "suede-burgundy", label: "Zamszowa bordo" },
];

const HANDLES: Option<Handles>[] = [
  { value: "none", label: "Bez uchwytu" },
  { value: "wood-light", label: "Drewno jasne" },
  { value: "wood-dark", label: "Drewno ciemne" },
  { value: "crochet", label: "Uchwyt szydełkowy" },
];

const STRAPS: Option<Strap>[] = [
  { value: "none", label: "Bez paska" },
  { value: "leather", label: "Pasek skórzany" },
  { value: "woven", label: "Pasek tkany" },
  { value: "chain", label: "Łańcuszek" },
];

const HARDWARE: Option<Hardware>[] = [
  { value: "gold", label: "Złote", swatch: "#C8A15D" },
  { value: "silver", label: "Srebrne", swatch: "#C9CDD2" },
  { value: "black", label: "Czarne", swatch: "#2E2C2E" },
];

const ACCENTS: Option<Accent>[] = [
  { value: "none", label: "Bez ozdoby" },
  { value: "tassel", label: "Chwost" },
  { value: "scarf", label: "Apaszka / kokarda" },
  { value: "charm", label: "Zawieszka" },
];

function readDraft(): BagBuilderConfig {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<BagBuilderConfig>;
    return { ...EMPTY, ...parsed };
  } catch {
    return EMPTY;
  }
}

function labelFor<T extends string>(options: Option<T>[], value: T | string) {
  return options.find((option) => option.value === value)?.label ?? "—";
}

function bodyPath(family: Family) {
  if (family === "round") return "M135 235 Q140 185 205 165 Q300 132 395 165 Q460 185 465 235 L478 335 Q486 414 432 470 Q378 525 300 525 Q222 525 168 470 Q114 414 122 335 Z";
  if (family === "bucket") return "M165 160 Q300 130 435 160 L468 456 Q472 505 424 520 Q300 548 176 520 Q128 505 132 456 Z";
  if (family === "mini") return "M175 220 Q180 185 218 175 L382 175 Q420 185 425 220 L440 430 Q442 470 405 485 Q300 510 195 485 Q158 470 160 430 Z";
  return "M135 185 Q140 150 178 145 L422 145 Q460 150 465 185 L478 465 Q480 505 440 515 L160 515 Q120 505 122 465 Z";
}

function topY(family: Family) {
  if (family === "mini") return 190;
  if (family === "round") return 175;
  return 150;
}

function hardwareColor(value: Hardware) {
  if (value === "silver") return "#C9CDD2";
  if (value === "black") return "#2E2C2E";
  return "#C8A15D";
}

function flapColor(config: BagBuilderConfig) {
  if (config.flap === "leather-black") return "#242124";
  if (config.flap === "leather-cognac") return "#7B4F34";
  if (config.flap === "suede-burgundy") return "#7F3043";
  return config.color || "#E8DDCC";
}

function strapColor(config: BagBuilderConfig) {
  if (config.strap === "leather") return config.flap.includes("black") ? "#242124" : "#6A493C";
  return "#8A666C";
}

function ChoiceGroup<T extends string>({ title, step, options, value, onChange, disabled = false, compact = false, dataKey }: {
  title: string;
  step: number;
  options: Option<T>[];
  value: string;
  onChange: (value: T) => void;
  disabled?: boolean;
  compact?: boolean;
  dataKey: string;
}) {
  return <fieldset className={`abags-builder-group${compact ? " is-compact" : ""}`} disabled={disabled}>
    <legend><span>{String(step).padStart(2, "0")}</span>{title}</legend>
    <div className="abags-builder-options">
      {options.map((option) => <button key={option.value} type="button" className={value === option.value ? "is-active" : ""} aria-pressed={value === option.value} onClick={() => onChange(option.value)} data-builder-key={dataKey} data-builder-value={option.value}>
        {option.swatch && <span className="abags-builder-swatch" style={{ background: option.swatch }} aria-hidden="true" />}
        <span className="abags-builder-option-copy"><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span>
      </button>)}
    </div>
  </fieldset>;
}

function BagPreview({ config }: { config: BagBuilderConfig }) {
  const body = bodyPath(config.family);
  const metal = hardwareColor(config.hardware);
  const stitch = config.stitch || "classic";
  const hasShape = Boolean(config.family);
  const hasColor = Boolean(config.color);
  const signature = [config.family, config.color, config.stitch, config.flap, config.handles, config.strap, config.hardware, config.accent].join("|");
  const handleTop = topY(config.family);
  const bagColor = config.color || "#EFE6DE";

  return <div className="abags-bag-builder-stage" data-builder-signature={signature} data-family={config.family} data-color={config.color} data-stitch={config.stitch} data-flap={config.flap} data-handles={config.handles} data-strap={config.strap} data-hardware={config.hardware} data-accent={config.accent}>
    <svg viewBox="0 0 600 600" role="img" aria-label={hasShape ? `Podgląd tworzonej torebki: ${labelFor(FAMILIES, config.family)}` : "Pusty podgląd konfiguratora"}>
      <defs>
        <filter id="abags-shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="18" stdDeviation="18" floodColor="#5A4245" floodOpacity="0.18" /></filter>
        <linearGradient id="abags-wood-light" x1="0" x2="1"><stop offset="0" stopColor="#E7C995" /><stop offset=".48" stopColor="#F3DDAF" /><stop offset="1" stopColor="#CFA96D" /></linearGradient>
        <linearGradient id="abags-wood-dark" x1="0" x2="1"><stop offset="0" stopColor="#4B251A" /><stop offset=".5" stopColor="#7B4530" /><stop offset="1" stopColor="#32170F" /></linearGradient>
        <linearGradient id="abags-leather" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={flapColor(config)} stopOpacity=".96" /><stop offset="1" stopColor={flapColor(config)} stopOpacity=".78" /></linearGradient>
        <linearGradient id="abags-woven" x1="0" x2="1"><stop offset="0" stopColor="#E6D6C0" /><stop offset=".22" stopColor="#8A666C" /><stop offset=".44" stopColor="#F2E7DB" /><stop offset=".66" stopColor="#C7962F" /><stop offset=".88" stopColor="#8A666C" /><stop offset="1" stopColor="#E6D6C0" /></linearGradient>
        <pattern id="abags-empty" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#FFFDFC" /><path d="M-2 16 L16 -2 M6 18 L18 6" stroke="#D8C9C5" strokeWidth="2" opacity=".48" /></pattern>
        <pattern id="abags-yarn-classic" width="28" height="24" patternUnits="userSpaceOnUse"><rect width="28" height="24" fill={bagColor} /><path d="M-3 23 C4 12 9 6 15 -2 M12 27 C19 16 24 10 31 1" fill="none" stroke="#FFFFFF" strokeWidth="5.8" strokeLinecap="round" opacity=".24" /><path d="M-3 21 C4 10 9 4 15 -4 M12 25 C19 14 24 8 31 -1" fill="none" stroke="#2A1D20" strokeWidth="1.8" strokeLinecap="round" opacity=".18" /></pattern>
        <pattern id="abags-yarn-herringbone" width="36" height="30" patternUnits="userSpaceOnUse"><rect width="36" height="30" fill={bagColor} /><path d="M-2 2 L9 15 L-2 28 M18 2 L29 15 L18 28 M38 2 L27 15 L38 28 M18 2 L7 15 L18 28" fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity=".22" /><path d="M-2 3 L9 15 L-2 27 M18 3 L29 15 L18 27 M38 3 L27 15 L38 27 M18 3 L7 15 L18 27" fill="none" stroke="#261A1C" strokeWidth="1.4" opacity=".2" /></pattern>
        <pattern id="abags-yarn-basket" width="34" height="34" patternUnits="userSpaceOnUse"><rect width="34" height="34" fill={bagColor} /><path d="M3 8 H31 M3 25 H31 M8 3 V31 M25 3 V31" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" opacity=".2" /><path d="M3 8 H31 M3 25 H31 M8 3 V31 M25 3 V31" stroke="#2A1D20" strokeWidth="1.5" strokeLinecap="round" opacity=".18" /></pattern>
        <pattern id="abags-yarn-shell" width="42" height="34" patternUnits="userSpaceOnUse"><rect width="42" height="34" fill={bagColor} /><path d="M2 29 Q10 8 21 29 Q32 8 40 29 M-19 12 Q-11 -9 0 12 Q11 -9 19 12 Q30 -9 38 12 Q49 -9 57 12" fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" opacity=".22" /><path d="M2 29 Q10 8 21 29 Q32 8 40 29 M-19 12 Q-11 -9 0 12 Q11 -9 19 12 Q30 -9 38 12 Q49 -9 57 12" fill="none" stroke="#2A1D20" strokeWidth="1.5" opacity=".18" /></pattern>
      </defs>
      <rect x="22" y="22" width="556" height="556" rx="42" fill="#FBF6F2" />
      <ellipse cx="300" cy="530" rx="190" ry="28" fill="#5A4245" opacity=".08" />
      {!hasShape && <g className="abags-builder-empty-state"><path d="M190 190 Q300 135 410 190 L430 440 Q300 500 170 440 Z" fill="none" stroke="#CDBABD" strokeWidth="4" strokeDasharray="10 10" /><text x="300" y="315" textAnchor="middle" className="abags-builder-svg-title">Wybierz fason</text><text x="300" y="342" textAnchor="middle" className="abags-builder-svg-copy">Tutaj zbudujesz torebkę od podstaw</text></g>}
      {hasShape && <g filter="url(#abags-shadow)">
        {config.strap !== "none" && <g data-layer="strap" className="abags-builder-layer abags-builder-layer-strap">{config.strap === "chain" ? <path d="M138 250 C70 160 80 70 180 45 C300 14 450 44 470 174 C480 220 458 252 455 270" fill="none" stroke={metal} strokeWidth="12" strokeDasharray="4 11" strokeLinecap="round" /> : <path d="M145 255 C82 172 88 85 185 52 C300 13 445 48 462 180 C469 225 455 250 452 270" fill="none" stroke={config.strap === "woven" ? "url(#abags-woven)" : strapColor(config)} strokeWidth={config.strap === "woven" ? 25 : 22} strokeLinecap="round" />}</g>}
        {config.handles !== "none" && <g data-layer="handles" className="abags-builder-layer abags-builder-layer-handles">{config.handles === "crochet" ? <path d={`M210 ${handleTop + 35} C205 ${handleTop - 75} 395 ${handleTop - 75} 390 ${handleTop + 35}`} fill="none" stroke={hasColor ? bagColor : "#D8C9C5"} strokeWidth="28" strokeLinecap="round" /> : <path d={`M215 ${handleTop + 28} C205 ${handleTop - 92} 395 ${handleTop - 92} 385 ${handleTop + 28}`} fill="none" stroke={config.handles === "wood-dark" ? "url(#abags-wood-dark)" : "url(#abags-wood-light)"} strokeWidth="30" strokeLinecap="round" />}</g>}
        <path data-layer="body" d={body} fill={hasColor ? `url(#abags-yarn-${stitch})` : "url(#abags-empty)"} stroke={hasColor ? bagColor : "#CDBABD"} strokeWidth="6" strokeLinejoin="round" />
        {config.flap !== "none" && <g data-layer="flap" className="abags-builder-layer abags-builder-layer-flap">{config.flap === "crochet" ? <path d={config.family === "round" ? "M155 225 Q300 105 445 225 Q420 315 300 340 Q180 315 155 225 Z" : "M160 175 Q300 125 440 175 L420 315 Q300 360 180 315 Z"} fill={hasColor ? `url(#abags-yarn-${stitch})` : "url(#abags-empty)"} stroke={bagColor} strokeWidth="5" /> : <path d={config.family === "round" ? "M155 225 Q300 105 445 225 Q420 315 300 340 Q180 315 155 225 Z" : "M160 170 Q300 135 440 170 L425 300 Q300 350 175 300 Z"} fill="url(#abags-leather)" stroke="#FFFFFF" strokeOpacity=".18" strokeWidth="3" />}<circle cx="300" cy={config.family === "round" ? 286 : 274} r="18" fill={metal} /><circle cx="300" cy={config.family === "round" ? 286 : 274} r="8" fill="#FFF" opacity=".7" /></g>}
        {(config.strap !== "none" || config.handles !== "none") && <g data-layer="hardware" className="abags-builder-layer abags-builder-layer-hardware"><circle cx="150" cy="238" r="11" fill="none" stroke={metal} strokeWidth="7" /><circle cx="450" cy="238" r="11" fill="none" stroke={metal} strokeWidth="7" /></g>}
        {config.accent === "tassel" && <g data-layer="accent" className="abags-builder-layer abags-builder-layer-accent"><circle cx="466" cy="250" r="9" fill={metal} /><path d="M472 258 Q488 270 482 292" fill="none" stroke={bagColor} strokeWidth="10" strokeLinecap="round" />{[0,1,2,3,4,5].map((index) => <path key={index} d={`M${473 + index * 4} 286 Q${478 + index * 4} 350 ${468 + index * 5} 405`} fill="none" stroke={index % 2 ? bagColor : "#F0D7DE"} strokeWidth="7" strokeLinecap="round" />)}</g>}
        {config.accent === "scarf" && <g data-layer="accent" className="abags-builder-layer abags-builder-layer-accent"><path d="M186 176 C135 135 104 160 130 206 C154 248 197 220 205 191 C215 229 259 250 279 211 C302 167 261 139 211 176 Z" fill="#F2C6D0" stroke="#FFFFFF" strokeWidth="3" /><path d="M196 192 L146 353 Q174 368 199 348 L220 207 Z" fill="#F6DDE3" /><path d="M211 194 L254 340 Q279 330 286 307 L224 203 Z" fill="#D9829A" opacity=".9" /><circle cx="173" cy="189" r="8" fill="#B95B74" /><circle cx="238" cy="196" r="7" fill="#C7962F" /></g>}
        {config.accent === "charm" && <g data-layer="accent" className="abags-builder-layer abags-builder-layer-accent"><path d="M455 246 Q492 265 487 302" fill="none" stroke={metal} strokeWidth="5" /><path d="M487 300 C470 278 444 301 487 336 C530 301 504 278 487 300 Z" fill="#B87880" stroke={metal} strokeWidth="4" /></g>}
        <g data-layer="label" className="abags-builder-layer abags-builder-layer-label"><rect x="260" y="452" width="80" height="24" rx="12" fill={metal} opacity=".9" /><text x="300" y="468" textAnchor="middle" fill="#FFF" fontSize="11" fontFamily="serif">a_bags</text></g>
      </g>}
    </svg>
    <div className="abags-builder-preview-status" aria-live="polite">{!hasShape ? <><strong>Zacznij od fasonu</strong><span>Podgląd pozostanie aktywny przez cały proces.</span></> : !hasColor ? <><strong>{labelFor(FAMILIES, config.family)}</strong><span>Teraz wybierz kolor sznurka.</span></> : <><strong>{labelFor(FAMILIES, config.family)} · {labelFor(COLORS, config.color)}</strong><span>{config.stitch ? labelFor(STITCHES, config.stitch) : "Wybierz ścieg szydełkowy"} · podgląd aktualizowany na żywo</span></>}</div>
  </div>;
}

export default function BagBuilderEngine() {
  const contact = usePublicContact();
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [preview, setPreview] = useState<HTMLElement | null>(null);
  const [config, setConfig] = useState<BagBuilderConfig>(readDraft);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const attach = () => {
      const dialog = document.querySelector<HTMLElement>(".abags-vc-dialog");
      if (!dialog) { setMount(null); setPreview(null); return; }
      const layout = dialog.querySelector<HTMLElement>(".abags-vc-layout");
      const previewColumn = layout?.querySelector<HTMLElement>(".abags-vc-preview-column") ?? null;
      let target = dialog.querySelector<HTMLElement>("[data-abags-exact-live]");
      if (!target) {
        target = document.createElement("div");
        target.dataset.abagsExactLive = "true";
        target.className = "abags-exact-live-mount";
        if (layout) layout.insertBefore(target, previewColumn);
        else dialog.appendChild(target);
      } else if (layout && target.parentElement !== layout) layout.insertBefore(target, previewColumn);
      if (!dialog.classList.contains("abags-vc-builder-active")) dialog.classList.add("abags-vc-exact-live-active", "abags-vc-builder-active");
      const eyebrow = dialog.querySelector<HTMLElement>(".abags-vc-header .eyebrow");
      const title = dialog.querySelector<HTMLElement>(".abags-vc-header h2");
      if (eyebrow && eyebrow.textContent !== "A-Bags Bag Builder 3.0") eyebrow.textContent = "A-Bags Bag Builder 3.0";
      if (title && title.textContent !== "Zbuduj swoją torebkę od podstaw.") title.textContent = "Zbuduj swoją torebkę od podstaw.";
      setMount((current) => current === target ? current : target);
      const nextPreview = dialog.querySelector<HTMLElement>(".abags-vc-preview");
      setPreview((current) => current === nextPreview ? current : nextPreview);
    };
    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      document.querySelectorAll<HTMLElement>(".abags-vc-dialog.abags-vc-builder-active").forEach((dialog) => dialog.classList.remove("abags-vc-exact-live-active", "abags-vc-builder-active"));
    };
  }, []);

  const update = <K extends keyof BagBuilderConfig>(key: K, value: BagBuilderConfig[K]) => {
    setConfig((current) => {
      const next = { ...current, [key]: value };
      if (key === "family") {
        const family = value as Family;
        if ((family === "round" || family === "mini") && current.handles.startsWith("wood-")) next.handles = "none";
      }
      return next;
    });
    setSaved(false);
  };

  const completed = useMemo(() => [config.family, config.color, config.stitch].filter(Boolean).length + [config.flap, config.handles, config.strap, config.hardware, config.accent].filter((value) => value && value !== "none").length, [config]);
  const canCustomize = Boolean(config.family && config.color);
  const canSave = Boolean(config.family && config.color && config.stitch);
  const familyHandles = useMemo(() => config.family === "round" || config.family === "mini" ? HANDLES.filter((item) => !item.value.startsWith("wood-")) : HANDLES, [config.family]);

  const reset = () => { setConfig(EMPTY); window.localStorage.removeItem(DRAFT_KEY); setSaved(false); };
  const save = () => {
    if (!canSave) return;
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(config));
    setSaved(true);
  };

  if (!mount || !preview) return null;

  const message = config.family ? `Dzień dobry! Chciałabym zamówić torebkę zaprojektowaną w A-Bags Bag Builder. Fason: ${labelFor(FAMILIES, config.family)}. Kolor sznurka: ${labelFor(COLORS, config.color)}. Ścieg szydełkowy: ${labelFor(STITCHES, config.stitch)}. Klapa: ${labelFor(FLAPS, config.flap)}. Uchwyty: ${labelFor(HANDLES, config.handles)}. Pasek: ${labelFor(STRAPS, config.strap)}. Okucia: ${labelFor(HARDWARE, config.hardware)}. Detal: ${labelFor(ACCENTS, config.accent)}. Materiał: sznurek poliestrowy z Pimiotki. Proszę o potwierdzenie możliwości wykonania, finalnej ceny i terminu.` : "Dzień dobry! Chciałabym zaprojektować własną torebkę A-Bags.";

  return <>
    {createPortal(<section className="abags-exact-live abags-builder-controls" aria-labelledby="abags-builder-title" data-abags-exact-workspace="controls">
      <div className="abags-exact-live-heading abags-builder-heading"><div><p className="eyebrow">A-Bags Atelier · Bag Builder 3.0</p><h3 id="abags-builder-title">Buduj torebkę krok po kroku.</h3><p>Najpierw wybierz fason. Potem nadaj mu kolor i ścieg szydełkowy, a następnie dodawaj klapę, uchwyty, pasek, okucia i ozdoby. Podgląd pozostaje aktywny przez cały czas.</p></div><span>{completed}/8 decyzji</span></div>
      <ChoiceGroup title="Fason" step={1} options={FAMILIES.filter((item): item is Option<Exclude<Family, "">> => Boolean(item.value))} value={config.family} onChange={(value) => update("family", value)} dataKey="family" />
      <ChoiceGroup title="Kolor sznurka" step={2} options={COLORS} value={config.color} onChange={(value) => update("color", value)} disabled={!config.family} compact dataKey="color" />
      <ChoiceGroup title="Ścieg szydełkowy" step={3} options={STITCHES.filter((item): item is Option<Exclude<Stitch, "">> => Boolean(item.value))} value={config.stitch} onChange={(value) => update("stitch", value)} disabled={!config.color} dataKey="stitch" />
      <ChoiceGroup title="Klapa" step={4} options={FLAPS} value={config.flap} onChange={(value) => update("flap", value)} disabled={!canCustomize} dataKey="flap" />
      <ChoiceGroup title="Uchwyty" step={5} options={familyHandles} value={config.handles} onChange={(value) => update("handles", value)} disabled={!canCustomize} dataKey="handles" />
      <ChoiceGroup title="Pasek" step={6} options={STRAPS} value={config.strap} onChange={(value) => update("strap", value)} disabled={!canCustomize} dataKey="strap" />
      <ChoiceGroup title="Okucia" step={7} options={HARDWARE} value={config.hardware} onChange={(value) => update("hardware", value)} disabled={!canCustomize} compact dataKey="hardware" />
      <ChoiceGroup title="Detal / ozdoba" step={8} options={ACCENTS} value={config.accent} onChange={(value) => update("accent", value)} disabled={!canCustomize} dataKey="accent" />
      <div className="abags-builder-summary" aria-live="polite"><div><strong>Twój projekt</strong><span>{saved ? "zapisany lokalnie ✓" : canSave ? "gotowy do zapisania" : "uzupełnij fason, kolor i ścieg szydełkowy"}</span></div><p>{config.family ? `${labelFor(FAMILIES, config.family)} · ${labelFor(COLORS, config.color)} · ${labelFor(STITCHES, config.stitch)}` : "Wybierz fason, aby rozpocząć projekt."}</p><small>Personalizacja jest wyceniana indywidualnie po potwierdzeniu projektu.</small></div>
      <div className="abags-exact-live-actions abags-builder-actions" data-builder-saved={saved ? "true" : "false"}>
        <button type="button" onClick={reset}>Wyczyść</button>
        <button type="button" onClick={save} disabled={!canSave} data-builder-save-state={saved ? "saved" : "ready"}>{saved ? "Zapisano ✓" : "Zapisz projekt"}</button>
        <a href={whatsappHref(contact.whatsappNumber, message)} target="_blank" rel="noopener noreferrer" aria-disabled={!canSave} onClick={(event) => { if (!canSave) event.preventDefault(); }}>Wyślij projekt do pracowni →</a>
      </div>
    </section>, mount)}
    {createPortal(<BagPreview config={config} />, preview)}
  </>;
}
