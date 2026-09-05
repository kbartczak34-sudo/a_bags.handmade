"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type Family = "tote" | "round" | "bucket" | "mini";
type Config = {
  family: Family | "";
  color: string;
  stitch: string;
  flap: string;
  handles: string;
  strap: string;
  hardware: string;
  accent: string;
  baseProductId: string;
};
type Settings = {
  pricingEnabled: boolean;
  familyBaseCents: Record<Family, number | null>;
  familyProductIds: Record<Family, string | null>;
  stitchCents: Record<string, number>;
  flapCents: Record<string, number>;
  handlesCents: Record<string, number>;
  strapCents: Record<string, number>;
  hardwareCents: Record<string, number>;
  accentCents: Record<string, number>;
  compatibility: {
    handles: Record<Family, string[]>;
    straps: Record<Family, string[]>;
    flaps: Record<Family, string[]>;
  };
};
type CatalogBase = { id: string; name: string; unitAmount: number; imageUrl: string | null };

const EMPTY: Config = { family: "", color: "", stitch: "", flap: "none", handles: "none", strap: "none", hardware: "gold", accent: "none", baseProductId: "" };
const money = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" });

function readConfig(stage: HTMLElement): Config {
  return {
    family: (stage.dataset.family || "") as Config["family"],
    color: stage.dataset.color || "",
    stitch: stage.dataset.stitch || "",
    flap: stage.dataset.flap || "none",
    handles: stage.dataset.handles || "none",
    strap: stage.dataset.strap || "none",
    hardware: stage.dataset.hardware || "gold",
    accent: stage.dataset.accent || "none",
    baseProductId: stage.dataset.photoProductId || "",
  };
}

function extras(config: Config, settings: Settings) {
  return (settings.stitchCents[config.stitch] ?? 0)
    + (settings.flapCents[config.flap] ?? 0)
    + (settings.handlesCents[config.handles] ?? 0)
    + (settings.strapCents[config.strap] ?? 0)
    + (settings.hardwareCents[config.hardware] ?? 0)
    + (settings.accentCents[config.accent] ?? 0);
}

function calculateTotal(config: Config, settings: Settings, photographedBase: CatalogBase | null) {
  if (!config.family || !settings.pricingEnabled) return null;
  if (photographedBase) return photographedBase.unitAmount + extras(config, settings);
  const base = settings.familyBaseCents[config.family];
  if (base === null) return null;
  return base + extras(config, settings);
}

function compatible(config: Config, settings: Settings) {
  if (!config.family) return false;
  return settings.compatibility.handles[config.family]?.includes(config.handles)
    && settings.compatibility.straps[config.family]?.includes(config.strap)
    && settings.compatibility.flaps[config.family]?.includes(config.flap);
}

export default function BagBuilderCheckoutHandoff() {
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [config, setConfig] = useState<Config>(EMPTY);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [catalog, setCatalog] = useState<CatalogBase[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/api/bag-builder-settings", { cache: "no-store", signal: controller.signal }).then(async (response) => {
        const payload = await response.json() as { settings?: Settings; error?: string };
        if (!response.ok || !payload.settings) throw new Error(payload.error || "Nie udało się wczytać ustawień sprzedaży.");
        return payload.settings;
      }),
      fetch("/api/products", { cache: "no-store", signal: controller.signal }).then(async (response) => {
        const payload = await response.json() as { products?: CatalogBase[] };
        if (!response.ok || !Array.isArray(payload.products)) return [];
        return payload.products;
      }),
    ]).then(([nextSettings, products]) => {
      setSettings(nextSettings);
      setCatalog(products);
    }).catch((reason) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Nie udało się wczytać ustawień sprzedaży.");
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const attach = () => {
      const controls = document.querySelector<HTMLElement>(".abags-builder-controls");
      const stage = document.querySelector<HTMLElement>(".abags-bag-builder-stage");
      const actions = controls?.querySelector<HTMLElement>(".abags-builder-actions");
      if (!controls || !stage || !actions) return;

      let target = controls.querySelector<HTMLElement>("[data-builder-checkout-handoff]");
      if (!target) {
        target = document.createElement("div");
        target.dataset.builderCheckoutHandoff = "true";
        actions.insertAdjacentElement("beforebegin", target);
      }
      setMount((current) => current === target ? current : target);
      setConfig(readConfig(stage));
    };

    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-family", "data-color", "data-stitch", "data-flap", "data-handles", "data-strap", "data-hardware", "data-accent", "data-photo-product-id"],
    });
    return () => {
      observer.disconnect();
      document.querySelector("[data-builder-checkout-handoff]")?.remove();
    };
  }, []);

  const complete = Boolean(config.family && config.color && config.stitch);
  const photographedBase = useMemo(() => config.baseProductId ? catalog.find((product) => product.id === config.baseProductId) ?? null : null, [catalog, config.baseProductId]);
  const total = useMemo(() => settings ? calculateTotal(config, settings, photographedBase) : null, [config, settings, photographedBase]);
  const mapped = Boolean(photographedBase || (settings && config.family && settings.familyProductIds[config.family]));
  const isCompatible = Boolean(settings && compatible(config, settings));
  const ready = Boolean(settings?.pricingEnabled && complete && mapped && isCompatible && total && total > 0);

  const startCheckout = async () => {
    if (!ready || pending) return;
    setPending(true);
    setError("");
    try {
      const { baseProductId, ...projectConfig } = config;
      const response = await fetch("/api/bag-builder-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: projectConfig, baseProductId: baseProductId || undefined }),
      });
      const payload = await response.json() as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error || "Nie udało się rozpocząć płatności projektu.");
      window.location.assign(payload.url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nie udało się rozpocząć płatności projektu.");
      setPending(false);
    }
  };

  if (!mount) return null;

  let title = "Zakup projektu online";
  let status = "konsultacja";
  let copy = "Dokończ model, kolor sznurka i ścieg szydełkowy. Projekt możesz nadal zapisać, udostępnić albo wysłać do pracowni.";
  if (complete && settings && !settings.pricingEnabled) {
    copy = "Pracownia nie włączyła jeszcze bezpośredniej sprzedaży personalizacji. Wyślij projekt do konsultacji i potwierdzenia ceny.";
  } else if (complete && settings?.pricingEnabled && !mapped) {
    copy = "Ten model nie ma jeszcze bezpiecznie powiązanego produktu bazowego do sprzedaży online. Konsultacja projektu pozostaje dostępna.";
  } else if (complete && settings && !isCompatible) {
    title = "Sprawdź konfigurację";
    copy = "Jedna z wybranych opcji nie jest kompatybilna z fasonem. Zmień ją przed zakupem.";
  } else if (ready && total !== null) {
    title = "Projekt gotowy do bezpiecznego zakupu";
    status = money.format(total / 100);
    copy = photographedBase
      ? `Bazą zamówienia jest dokładnie widoczny produkt: ${photographedBase.name}. Cena bazowa pochodzi z katalogu sklepu, a personalizacja jest ponownie liczona na serwerze.`
      : "Cena zostanie ponownie obliczona na serwerze, a produkt bazowy przejdzie kontrolę dostępności i danych bezpieczeństwa przed Stripe Checkout.";
  }

  return createPortal(
    <section className="abags-builder-summary" aria-live="polite" data-builder-checkout-ready={ready ? "true" : "false"} data-photo-checkout-product={photographedBase?.id || ""}>
      <div><strong>{title}</strong><span>{status}</span></div>
      <p>{copy}</p>
      <small>Sznurek poliestrowy z Pimiotki · płatność Stripe / BLIK po walidacji projektu.</small>
      {error && <p role="alert">{error}</p>}
      {ready && <button type="button" onClick={() => void startCheckout()} disabled={pending}>{pending ? "Przekierowanie do Stripe…" : `Kup ten projekt · ${money.format((total ?? 0) / 100)} →`}</button>}
    </section>,
    mount,
  );
}
