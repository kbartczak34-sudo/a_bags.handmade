"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  useBagBuilderClientConfig,
  type BagBuilderClientConfig,
} from "./bag-builder-config-store";

type Family = "tote" | "round" | "bucket" | "mini";
type Config = BagBuilderClientConfig;
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
type EvidenceOption = {
  family: Config["family"];
  stitch: Config["stitch"];
  color: Config["color"];
  binding: {
    cordMaterialId: string;
    gaugeProfileId: string;
    goldenMasterId: string;
  };
};
type ResolveResponse = {
  pricing?: { grossCents?: number | null; status?: string };
  validation?: { valid?: boolean; blockers?: Array<{ message?: string }> };
  productionPackagePreview?: unknown;
  productionPackageHash?: string | null;
  sellability?: { status?: string; message?: string };
  error?: string;
};
type SnapshotResponse = {
  snapshotId?: string;
  productionPackageHash?: string;
  error?: string;
};
type CheckoutResponse = { url?: string; error?: string };

const money = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" });

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

async function readError(response: Response, fallback: string) {
  try {
    const payload = await response.json() as { error?: string };
    return payload.error || fallback;
  } catch {
    return fallback;
  }
}

export default function BagBuilderCheckoutHandoff() {
  const config = useBagBuilderClientConfig();
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [catalog, setCatalog] = useState<CatalogBase[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");

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
      const actions = controls?.querySelector<HTMLElement>(".abags-builder-actions");
      if (!controls || !actions) return;

      let target = controls.querySelector<HTMLElement>("[data-builder-checkout-handoff]");
      if (!target) {
        target = document.createElement("div");
        target.dataset.builderCheckoutHandoff = "true";
        actions.insertAdjacentElement("beforebegin", target);
      }
      setMount((current) => current === target ? current : target);
    };

    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
    return () => {
      observer.disconnect();
      document.querySelector("[data-builder-checkout-handoff]")?.remove();
    };
  }, []);

  const complete = Boolean(config.family && config.color && config.stitch);
  const photographedBase = useMemo(
    () => config.baseProductId ? catalog.find((product) => product.id === config.baseProductId) ?? null : null,
    [catalog, config.baseProductId],
  );
  const total = useMemo(
    () => settings ? calculateTotal(config, settings, photographedBase) : null,
    [config, settings, photographedBase],
  );
  const mapped = Boolean(photographedBase || (settings && config.family && settings.familyProductIds[config.family]));
  const isCompatible = Boolean(settings && compatible(config, settings));
  const ready = Boolean(settings?.pricingEnabled && complete && mapped && isCompatible && total && total > 0);

  const startCheckout = async () => {
    const normalizedEmail = email.trim();
    if (!ready || pending) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Podaj poprawny adres e-mail, aby bezpiecznie rozpocząć zamówienie.");
      return;
    }

    setPending(true);
    setError("");

    try {
      const evidenceResponse = await fetch(
        `/api/configurator/evidence?family=${encodeURIComponent(config.family)}&stitch=${encodeURIComponent(config.stitch)}&color=${encodeURIComponent(config.color)}`,
        { cache: "no-store" },
      );
      if (!evidenceResponse.ok) {
        throw new Error(await readError(evidenceResponse, "Nie udało się potwierdzić fizycznego wariantu korpusu."));
      }
      const evidencePayload = await evidenceResponse.json() as { options?: EvidenceOption[]; error?: string };
      const evidence = evidencePayload.options?.find((option) =>
        option.family === config.family && option.stitch === config.stitch && option.color === config.color,
      );
      if (!evidence) {
        throw new Error("Ten wariant nie ma aktualnie kompletnego, zwalidowanego łańcucha materiał → Gauge → Golden Master.");
      }

      const source = buildV2Source(config, evidence);
      const resolveResponse = await fetch("/api/configurator/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ config: source }),
      });
      const resolved = await resolveResponse.json() as ResolveResponse;
      if (!resolveResponse.ok) {
        throw new Error(resolved.error || "Nie udało się ponownie zwalidować projektu przed płatnością.");
      }
      if (resolved.validation?.valid !== true || !resolved.productionPackagePreview || !resolved.productionPackageHash) {
        const blocker = resolved.validation?.blockers?.find((item) => item.message)?.message;
        throw new Error(blocker || resolved.sellability?.message || "Zakup 1:1 jest obecnie zablokowany dla tej konfiguracji.");
      }

      const snapshotResponse = await fetch("/api/configurator/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ config: source }),
      });
      const snapshot = await snapshotResponse.json() as SnapshotResponse;
      if (!snapshotResponse.ok || !snapshot.snapshotId || snapshot.productionPackageHash !== resolved.productionPackageHash) {
        throw new Error(snapshot.error || "Nie udało się utrwalić niezmiennego Production Snapshot.");
      }

      const checkoutResponse = await fetch("/api/configurator/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ snapshotId: snapshot.snapshotId, email: normalizedEmail }),
      });
      const checkout = await checkoutResponse.json() as CheckoutResponse;
      if (!checkoutResponse.ok || !checkout.url) {
        throw new Error(checkout.error || "Nie udało się rozpocząć bezpiecznej płatności projektu.");
      }

      window.location.assign(checkout.url);
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
    title = "Projekt gotowy do ponownej walidacji";
    status = money.format(total / 100);
    copy = photographedBase
      ? `Bazą projektu jest widoczny produkt: ${photographedBase.name}. Przed płatnością system ponownie sprawdzi referencję fizyczną, BOM, recepturę i cenę.`
      : "Przed płatnością system ponownie sprawdzi fizyczne powiązania, BOM, recepturę i cenę, a następnie zapisze niezmienny Production Snapshot.";
  }

  return createPortal(
    <section className="abags-builder-summary" aria-live="polite" data-builder-checkout-ready={ready ? "true" : "false"} data-photo-checkout-product={photographedBase?.id || ""}>
      <div><strong>{title}</strong><span>{status}</span></div>
      <p>{copy}</p>
      {ready && (
        <label>
          <span>E-mail do potwierdzenia zamówienia</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="twoj@email.pl"
            disabled={pending}
            required
            aria-describedby={error ? "abags-configurator-checkout-error" : undefined}
          />
        </label>
      )}
      <small>Sznurek poliestrowy z Pimiotki · płatność Stripe / BLIK po pełnej walidacji projektu.</small>
      {error && <p id="abags-configurator-checkout-error" role="alert">{error}</p>}
      {ready && <button type="button" onClick={() => void startCheckout()} disabled={pending}>{pending ? "Waliduję i przygotowuję Stripe…" : `Kup ten projekt · ${money.format((total ?? 0) / 100)} →`}</button>}
    </section>,
    mount,
  );
}
