"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { isAgataBuilderConstructionSupported, type AgataBuilderConstructionKey } from "../lib/abags-builder-fidelity";

type Family = "" | "tote" | "round" | "bucket" | "mini";
type Stitch = "" | "classic" | "herringbone" | "basket" | "shell";
type Flap = "none" | "crochet" | "leather-black" | "leather-cognac" | "suede-burgundy";
type Handles = "none" | "wood-light" | "wood-dark" | "crochet";
type Strap = "none" | "leather" | "woven" | "chain";
type Hardware = "gold" | "silver" | "black";
type Accent = "none" | "tassel" | "scarf" | "charm";

type Config = { family: Family; color: string; stitch: Stitch; flap: Flap; handles: Handles; strap: Strap; hardware: Hardware; accent: Accent };

type Settings = {
  pricingEnabled: boolean;
  currency: "PLN";
  familyBaseCents: Record<Exclude<Family, "">, number | null>;
  stitchCents: Record<Exclude<Stitch, "">, number>;
  flapCents: Record<Flap, number>;
  handlesCents: Record<Handles, number>;
  strapCents: Record<Strap, number>;
  hardwareCents: Record<Hardware, number>;
  accentCents: Record<Accent, number>;
  compatibility: {
    handles: Record<Exclude<Family, "">, Handles[]>;
    straps: Record<Exclude<Family, "">, Strap[]>;
    flaps: Record<Exclude<Family, "">, Flap[]>;
  };
};

type ConstructionKey = "handles" | "strap" | "flap" | "accent";

const EMPTY: Config = { family: "", color: "", stitch: "", flap: "none", handles: "none", strap: "none", hardware: "gold", accent: "none" };
const money = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" });

const FIDELITY_KEYS: Record<ConstructionKey, AgataBuilderConstructionKey> = {
  handles: "handles",
  strap: "straps",
  flap: "flaps",
  accent: "accents",
};

function readConfig(stage: HTMLElement): Config {
  return {
    family: (stage.dataset.family || "") as Family,
    color: stage.dataset.color || "",
    stitch: (stage.dataset.stitch || "") as Stitch,
    flap: (stage.dataset.flap || "none") as Flap,
    handles: (stage.dataset.handles || "none") as Handles,
    strap: (stage.dataset.strap || "none") as Strap,
    hardware: (stage.dataset.hardware || "gold") as Hardware,
    accent: (stage.dataset.accent || "none") as Accent,
  };
}

function sameConfig(a: Config, b: Config) {
  return (Object.keys(a) as Array<keyof Config>).every((key) => a[key] === b[key]);
}

function label(key: string, value: string) {
  const labels: Record<string, Record<string, string>> = {
    family: { tote: "Kuferek / tote", round: "Okrągła", bucket: "Z klapą", mini: "Strukturalna / mini" },
    stitch: { classic: "Ażurowy V", herringbone: "Pionowy ażurowy", basket: "Koszykowy", shell: "Promienisty" },
    flap: { none: "Bez klapy", crochet: "Klapa szydełkowa", "leather-black": "Klapa skórzana czarna", "leather-cognac": "Klapa skórzana koniak", "suede-burgundy": "Klapa zamszowa bordo" },
    handles: { none: "Bez uchwytu", "wood-light": "Drewno jasne", "wood-dark": "Drewno ciemne", crochet: "Uchwyt szydełkowy" },
    strap: { none: "Bez paska", leather: "Pasek skórzany", woven: "Pasek tkany", chain: "Łańcuszek" },
    hardware: { gold: "Okucia złote", silver: "Okucia srebrne", black: "Okucia czarne" },
    accent: { none: "Bez ozdoby", tassel: "Chwost", scarf: "Apaszka / kokarda", charm: "Zawieszka" },
  };
  return labels[key]?.[value] ?? value;
}

function adminAllows(settings: Settings, family: Exclude<Family, "">, key: ConstructionKey, value: string) {
  if (key === "accent") return true;
  if (key === "handles") return settings.compatibility.handles[family].includes(value as Handles);
  if (key === "strap") return settings.compatibility.straps[family].includes(value as Strap);
  return settings.compatibility.flaps[family].includes(value as Flap);
}

function compatible(settings: Settings, family: Exclude<Family, "">, key: ConstructionKey, value: string) {
  return adminAllows(settings, family, key, value)
    && isAgataBuilderConstructionSupported(family, FIDELITY_KEYS[key], value);
}

export default function BagBuilderCommerce() {
  const [stage, setStage] = useState<HTMLElement | null>(null);
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [config, setConfig] = useState<Config>(EMPTY);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/bag-builder-settings", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<{ settings: Settings }>;
      })
      .then((payload) => { if (!cancelled) setSettings(payload.settings); })
      .catch(() => { if (!cancelled) setLoadFailed(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const attach = () => {
      const nextStage = document.querySelector<HTMLElement>(".abags-bag-builder-stage");
      setStage((current) => current === nextStage ? current : nextStage);
      const controls = document.querySelector<HTMLElement>(".abags-builder-controls");
      if (!controls) { setMount(null); return; }
      let target = controls.querySelector<HTMLElement>("[data-abags-builder-commerce]");
      if (!target) {
        target = document.createElement("div");
        target.dataset.abagsBuilderCommerce = "true";
        target.className = "abags-builder-commerce-mount";
        const actions = controls.querySelector(".abags-builder-actions");
        controls.insertBefore(target, actions ?? null);
      }
      setMount((current) => current === target ? current : target);
    };
    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!stage) return;
    const sync = () => setConfig((current) => {
      const next = readConfig(stage);
      return sameConfig(current, next) ? current : next;
    });
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(stage, { attributes: true, attributeFilter: ["data-family", "data-color", "data-stitch", "data-flap", "data-handles", "data-strap", "data-hardware", "data-accent"] });
    return () => observer.disconnect();
  }, [stage]);

  useEffect(() => {
    if (!settings || !config.family) return;
    const family = config.family;
    const keys: ConstructionKey[] = ["handles", "strap", "flap", "accent"];

    for (const key of keys) {
      document.querySelectorAll<HTMLButtonElement>(`[data-builder-key="${key}"]`).forEach((button) => {
        const value = button.dataset.builderValue || "";
        const isCompatible = compatible(settings, family, key, value);
        button.disabled = !isCompatible;
        button.classList.toggle("is-incompatible", !isCompatible);
        button.setAttribute("aria-disabled", isCompatible ? "false" : "true");
        if (!isCompatible) button.title = "Ta opcja nie występuje w zweryfikowanych konstrukcjach tego fasonu A-Bags.";
        else button.removeAttribute("title");
      });
    }

    const currentSelections: Array<[ConstructionKey, string]> = [
      ["handles", config.handles],
      ["strap", config.strap],
      ["flap", config.flap],
      ["accent", config.accent],
    ];
    for (const [key, value] of currentSelections) {
      if (compatible(settings, family, key, value)) continue;
      document.querySelector<HTMLButtonElement>(`[data-builder-key="${key}"][data-builder-value="none"]`)?.click();
    }
  }, [config.family, config.handles, config.strap, config.flap, config.accent, settings]);

  const price = useMemo(() => {
    if (!settings?.pricingEnabled || !config.family) return null;
    const base = settings.familyBaseCents[config.family];
    if (base === null) return null;
    let total = base;
    const rows: Array<{ label: string; cents: number }> = [{ label: `Fason · ${label("family", config.family)}`, cents: base }];
    const add = (name: string, cents: number) => { if (cents > 0) rows.push({ label: name, cents }); total += cents; };
    if (config.stitch) add(`Ścieg szydełkowy · ${label("stitch", config.stitch)}`, settings.stitchCents[config.stitch]);
    add(label("flap", config.flap), settings.flapCents[config.flap]);
    add(label("handles", config.handles), settings.handlesCents[config.handles]);
    add(label("strap", config.strap), settings.strapCents[config.strap]);
    add(label("hardware", config.hardware), settings.hardwareCents[config.hardware]);
    add(label("accent", config.accent), settings.accentCents[config.accent]);
    return { total, rows };
  }, [config, settings]);

  if (!mount) return null;

  return createPortal(
    <section className="abags-builder-commerce" data-builder-live-price={price ? String(price.total) : "quote"} aria-live="polite">
      <div className="abags-builder-commerce-head">
        <div><span>Zgodność projektu</span><strong>{config.family ? "Konfiguracja sprawdzana na żywo" : "Wybierz fason"}</strong></div>
        <span className="abags-builder-commerce-ok">{config.family ? "✓ zgodna z konstrukcjami A-Bags" : "—"}</span>
      </div>
      {price ? <>
        <div className="abags-builder-live-price"><span>Cena projektu</span><strong>{money.format(price.total / 100)}</strong></div>
        <details className="abags-builder-price-breakdown"><summary>Pokaż skład ceny</summary>{price.rows.map((row) => <div key={`${row.label}-${row.cents}`}><span>{row.label}</span><strong>{money.format(row.cents / 100)}</strong></div>)}</details>
      </> : <div className="abags-builder-live-price is-quote"><span>Cena projektu</span><strong>Wycena indywidualna</strong><small>{loadFailed ? "Cena zostanie potwierdzona przez pracownię." : settings?.pricingEnabled ? "Uzupełnij cenę bazową tego fasonu w panelu właścicielki." : "Cena zostanie potwierdzona po przesłaniu projektu do pracowni."}</small></div>}
    </section>,
    mount,
  );
}