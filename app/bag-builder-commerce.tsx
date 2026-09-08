"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { isAgataBuilderConstructionSupported, type AgataBuilderConstructionKey } from "../lib/abags-builder-fidelity";
import { useBagBuilderClientConfig } from "./bag-builder-config-store";

type Family = "" | "tote" | "round" | "bucket" | "mini";
type Stitch = "" | "classic" | "herringbone" | "basket" | "shell";
type Flap = "none" | "crochet" | "leather-black" | "leather-cognac" | "suede-burgundy";
type Handles = "none" | "wood-light" | "wood-dark" | "crochet";
type Strap = "none" | "leather" | "woven" | "chain";
type Hardware = "gold" | "silver" | "black";
type Accent = "none" | "tassel" | "scarf" | "charm";

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

type ResolverShadowResponse = {
  resolverVersion: string;
  configurationHash: string;
  status: "BODY_VALIDATED" | "BLOCKED";
  pricing: {
    status: "AVAILABLE" | "DISABLED" | "UNAVAILABLE";
    grossCents: number | null;
  };
  productionPackageHash?: string | null;
  sellability?: { status?: string; message?: string };
  validation?: { valid?: boolean };
};

type EvidenceOption = {
  family: Exclude<Family, "">;
  stitch: Exclude<Stitch, "">;
  color: string;
  binding: {
    cordMaterialId: string;
    gaugeProfileId: string;
    goldenMasterId: string;
  };
};

type Config = ReturnType<typeof useBagBuilderClientConfig>;

type ConstructionKey = "handles" | "strap" | "flap" | "accent";

const money = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" });

const FIDELITY_KEYS: Record<ConstructionKey, AgataBuilderConstructionKey> = {
  handles: "handles",
  strap: "straps",
  flap: "flaps",
  accent: "accents",
};

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

function buildV2Source(config: Config, evidence: EvidenceOption) {
  return {
    schemaVersion: 2 as const,
    source: "DIGITAL_CRAFT_TWIN" as const,
    selection: {
      family: config.family,
      color: config.color,
      stitch: config.stitch,
      flap: config.flap,
      handles: config.handles,
      strap: config.strap,
      hardware: config.hardware,
      accent: config.accent,
    },
    physicalBinding: evidence.binding,
  };
}

export default function BagBuilderCommerce() {
  const config = useBagBuilderClientConfig();
  const [stage, setStage] = useState<HTMLElement | null>(null);
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [serverStatus, setServerStatus] = useState<"checking" | "validated" | "blocked" | "unavailable">("checking");
  const [serverPrice, setServerPrice] = useState<number | null>(null);
  const [productionPackageHash, setProductionPackageHash] = useState<string | null>(null);

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

  const localValid = useMemo(() => {
    if (!settings || !config.family) return false;
    const family = config.family;
    return compatible(settings, family, "handles", config.handles)
      && compatible(settings, family, "strap", config.strap)
      && compatible(settings, family, "flap", config.flap)
      && compatible(settings, family, "accent", config.accent);
  }, [config.accent, config.family, config.flap, config.handles, config.strap, settings]);

  useEffect(() => {
    let active = true;
    if (!stage || !settings || !config.family || !config.color || !config.stitch) {
      setServerStatus(config.family || config.color || config.stitch ? "checking" : "unavailable");
      setServerPrice(null);
      setProductionPackageHash(null);
      return;
    }

    const controller = new AbortController();
    setServerStatus("checking");
    setServerPrice(null);
    setProductionPackageHash(null);

    const timer = window.setTimeout(async () => {
      try {
        const evidenceResponse = await fetch(
          `/api/configurator/evidence?family=${encodeURIComponent(config.family)}&stitch=${encodeURIComponent(config.stitch)}&color=${encodeURIComponent(config.color)}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (!evidenceResponse.ok) throw new Error(String(evidenceResponse.status));
        const evidencePayload = await evidenceResponse.json() as { options?: EvidenceOption[] };
        const evidence = evidencePayload.options?.find((option) =>
          option.family === config.family && option.stitch === config.stitch && option.color === config.color,
        );
        if (!evidence) {
          if (active) {
            setServerStatus("blocked");
            setServerPrice(null);
            setProductionPackageHash(null);
            stage.dataset.resolverParity = "blocked-no-physical-evidence";
          }
          return;
        }

        const resolveResponse = await fetch("/api/configurator/resolve", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config: buildV2Source(config, evidence) }),
          signal: controller.signal,
        });
        if (!resolveResponse.ok) throw new Error(String(resolveResponse.status));
        const resolved = await resolveResponse.json() as ResolverShadowResponse;
        if (!active) return;

        const nextServerPrice = resolved.pricing.status === "AVAILABLE" ? resolved.pricing.grossCents : null;
        const localPrice = price?.total ?? null;
        const priceMatch = nextServerPrice === localPrice;
        const packageReady = typeof resolved.productionPackageHash === "string" && resolved.productionPackageHash.length > 0;
        const validationMatch = resolved.validation?.valid === true;
        const fullyReady = validationMatch && packageReady && priceMatch;
        const parity = fullyReady ? "match" : "mismatch";

        setServerStatus(fullyReady ? "validated" : "blocked");
        setServerPrice(nextServerPrice);
        setProductionPackageHash(packageReady ? resolved.productionPackageHash! : null);

        stage.dataset.resolverVersion = resolved.resolverVersion;
        stage.dataset.configurationHash = resolved.configurationHash;
        stage.dataset.resolverStatus = resolved.status.toLowerCase();
        stage.dataset.resolverParity = parity;

        window.dispatchEvent(new CustomEvent("abags:configurator-resolver-shadow", {
          detail: {
            configurationHash: resolved.configurationHash,
            resolverVersion: resolved.resolverVersion,
            parity,
            validationMatch,
            packageReady,
            priceMatch,
            localPrice,
            serverPrice: nextServerPrice,
          },
        }));

        if (parity === "mismatch") {
          console.warn("[configurator-shadow] V2 resolver parity mismatch", {
            configurationHash: resolved.configurationHash,
            validationMatch,
            packageReady,
            priceMatch,
            serverStatus: resolved.status,
          });
        }
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (!active) return;
        setServerStatus("unavailable");
        setServerPrice(null);
        setProductionPackageHash(null);
        stage.dataset.resolverParity = "unavailable";
      }
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [config, localValid, price, settings, stage]);

  if (!mount) return null;

  const authoritativePrice = serverPrice ?? price?.total ?? null;
  const serverReady = serverStatus === "validated"
    && localValid
    && Boolean(productionPackageHash)
    && Boolean(authoritativePrice && authoritativePrice > 0);

  return createPortal(
    <section className="abags-builder-commerce" data-builder-live-price={authoritativePrice !== null ? String(authoritativePrice) : "quote"} data-builder-server-status={serverStatus} data-builder-server-ready={serverReady ? "true" : "false"} aria-live="polite">
      <div className="abags-builder-commerce-head">
        <div>
          <span>Zgodność projektu</span>
          <strong>
            {!config.family
              ? "Wybierz fason"
              : serverStatus === "checking"
                ? "Sprawdzam fizyczną referencję…"
                : serverStatus === "validated"
                  ? "Konfiguracja zwalidowana na serwerze"
                  : serverStatus === "blocked"
                    ? "Konfiguracja wymaga uzupełnienia walidacji"
                    : "Walidacja serwera chwilowo niedostępna"}
          </strong>
        </div>
        <span className="abags-builder-commerce-ok">
          {serverStatus === "validated" ? "✓ V2" : serverStatus === "checking" ? "…" : "—"}
        </span>
      </div>
      {authoritativePrice !== null && serverStatus === "validated" ? <>
        <div className="abags-builder-live-price"><span>Cena projektu</span><strong>{money.format(authoritativePrice / 100)}</strong></div>
        <details className="abags-builder-price-breakdown"><summary>Pokaż skład ceny</summary>{price?.rows.map((row) => <div key={`${row.label}-${row.cents}`}><span>{row.label}</span><strong>{money.format(row.cents / 100)}</strong></div>)}</details>
      </> : <div className="abags-builder-live-price is-quote">
        <span>Cena projektu</span>
        <strong>{authoritativePrice !== null ? money.format(authoritativePrice / 100) : "Wycena indywidualna"}</strong>
        <small>
          {serverStatus === "blocked"
            ? "Ten wariant nie przejdzie jeszcze pełnej walidacji produkcyjnej. Zakup zostanie odblokowany dopiero po zatwierdzeniu kompletnego łańcucha fizycznego."
            : loadFailed
              ? "Cena zostanie potwierdzona przez pracownię."
              : settings?.pricingEnabled
                ? "Trwa potwierdzanie fizycznej referencji, receptury i BOM."
                : "Cena zostanie potwierdzona po przesłaniu projektu do pracowni."}
        </small>
      </div>}
    </section>,
    mount,
  );
}
