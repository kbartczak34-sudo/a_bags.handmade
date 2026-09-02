"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePublicContact, whatsappHref } from "./public-contact";

const PERSONALIZE_LABEL = "Personalizuj torebkę";
const DRAFT_KEY = "abags-customizer-draft-v2";

type Product = { id: string; name: string; detail: string; stitchType: string; price: number; imageUrl: string | null };
type Config = { productId: string; color: string; stitch: string; handles: string; hardware: string; strap: string; accent: string };
type Option = { label: string; value: string; swatch?: string };
type CustomizerAsset = { productId: string; category: keyof Omit<Config, "productId">; variant: string; imageUrl: string; updatedAt: string };

const COLORS: Option[] = [
  { label: "Naturalny beż", value: "natural-bez", swatch: "#d8c3a8" }, { label: "Pudrowy róż", value: "pudrowy-roz", swatch: "#d9a3aa" },
  { label: "Głęboki granat", value: "gleboki-granat", swatch: "#24324d" }, { label: "Czekoladowy brąz", value: "czekoladowy-braz", swatch: "#65493d" },
  { label: "Musztardowy", value: "musztardowy", swatch: "#c7962f" }, { label: "Czarny", value: "czarny", swatch: "#242224" },
];
const HANDLES: Option[] = [{ label: "Klasyczne", value: "klasyczne" }, { label: "Drewniane", value: "drewniane" }, { label: "Łańcuszek", value: "lancuszek" }];
const HARDWARE: Option[] = [{ label: "Złote", value: "zlote", swatch: "#b9944d" }, { label: "Srebrne", value: "srebrne", swatch: "#bfc2c6" }, { label: "Czarne", value: "czarne", swatch: "#302e30" }];
const STRAPS: Option[] = [{ label: "Bez dodatkowego paska", value: "bez-paska" }, { label: "Regulowany", value: "regulowany" }, { label: "Łańcuszek premium", value: "lancuszek-premium" }];
const ACCENTS: Option[] = [{ label: "Bez ozdoby", value: "bez-ozdoby" }, { label: "Chwost", value: "chwost" }, { label: "Apaszka / kokarda", value: "apaszka" }, { label: "Zawieszka", value: "zawieszka" }];
const money = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" });
const EMPTY_CONFIG: Config = { productId: "", color: "", stitch: "", handles: "", hardware: "", strap: "", accent: "" };

function slug(value: string) { return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function sanitizeConfig(value: unknown): Config {
  if (!value || typeof value !== "object") return EMPTY_CONFIG;
  const candidate = value as Partial<Record<keyof Config, unknown>>;
  return Object.fromEntries((Object.keys(EMPTY_CONFIG) as (keyof Config)[]).map((key) => [key, typeof candidate[key] === "string" ? candidate[key] : ""])) as Config;
}
function restoreDraft(): Config {
  if (typeof window === "undefined") return EMPTY_CONFIG;
  try { const stored = window.localStorage.getItem(DRAFT_KEY); return stored ? sanitizeConfig(JSON.parse(stored)) : EMPTY_CONFIG; }
  catch { window.localStorage.removeItem(DRAFT_KEY); return EMPTY_CONFIG; }
}
function labelFor(options: Option[], value: string, fallback = "—") { return options.find((option) => option.value === value)?.label ?? (value || fallback); }
function findLegacyConfiguratorButton() { return Array.from(document.querySelectorAll<HTMLButtonElement>(".abags-experience-actions > button")).find((button) => button.textContent?.includes("Stwórz własną torebkę")); }
function createNavigationLink(container: Element, onOpen: () => void, mobile = false) {
  if (container.querySelector("[data-abags-personalize-link]")) return;
  const link = document.createElement("a"); link.href = "#personalizacja"; link.dataset.abagsPersonalizeLink = "true";
  link.className = mobile ? "abags-personalize-nav-link abags-personalize-nav-link-mobile" : "abags-personalize-nav-link"; link.textContent = PERSONALIZE_LABEL;
  link.setAttribute("aria-label", "Otwórz wizualny konfigurator personalizacji torebki");
  link.addEventListener("click", (event) => { event.preventDefault(); if (mobile) document.querySelector<HTMLButtonElement>(".menu-button[aria-expanded='true']")?.click(); onOpen(); });
  if (mobile) container.insertBefore(link, container.firstChild); else container.appendChild(link);
}
function OptionButtons({ options, value, onChange, label, availableVariants, availabilityReady }: { options: Option[]; value: string; onChange: (value: string) => void; label: string; availableVariants?: Set<string>; availabilityReady?: boolean }) {
  return <div className="abags-vc-options" role="group" aria-label={label}>{options.map((option) => {
    const visualized = availableVariants?.has(option.value) ?? false;
    return <button key={option.value} type="button" className={value === option.value ? "is-active" : ""} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
      {option.swatch && <span className="abags-vc-swatch" style={{ background: option.swatch }} aria-hidden="true" />}<span>{option.label}</span>
      {availabilityReady && <small className={visualized ? "abags-vc-availability is-ready" : "abags-vc-availability"}>{visualized ? "podgląd ✓" : "bez warstwy"}</small>}
    </button>;
  })}</div>;
}
function LayerImage({ src }: { src: string }) { const [visible, setVisible] = useState(true); if (!visible) return null; return <img className="abags-vc-layer" src={src} alt="" aria-hidden="true" onError={() => setVisible(false)} />; }

export default function PersonalizationEntry() {
  const contact = usePublicContact();
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [config, setConfig] = useState<Config>(restoreDraft);
  const [assets, setAssets] = useState<CustomizerAsset[]>([]);
  const [assetsProductId, setAssetsProductId] = useState("");
  const [saved, setSaved] = useState(false);
  const [showBase, setShowBase] = useState(false);
  const dialogRef = useRef<HTMLElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/products", { cache: "no-store", signal: controller.signal }).then(async (response) => response.ok ? response.json() : Promise.reject(new Error("products unavailable"))).then((data: { products?: Product[] }) => {
      const items = Array.isArray(data.products) ? data.products : [];
      setProducts(items);
      if (items.length === 0) return;
      setConfig((current) => {
        if (current.productId && items.some((item) => item.id === current.productId)) return current;
        const first = items[0];
        return { ...current, productId: first.id, stitch: first.stitchType ? slug(first.stitchType) : current.stitch };
      });
    }).catch(() => { if (!controller.signal.aborted) setProducts([]); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!config.productId) return;
    const requestedProductId = config.productId;
    const controller = new AbortController();
    fetch(`/api/customizer-assets?productId=${encodeURIComponent(requestedProductId)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.assets)) throw new Error("customizer assets unavailable");
        return data.assets as CustomizerAsset[];
      })
      .then((items) => {
        if (controller.signal.aborted) return;
        setAssets(items);
        setAssetsProductId(requestedProductId);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setAssets([]);
          setAssetsProductId(requestedProductId);
        }
      });
    return () => controller.abort();
  }, [config.productId]);

  useEffect(() => {
    const collection = document.getElementById("kolekcja");
    if (!collection?.parentElement) return;
    const mount = document.createElement("div");
    mount.className = "abags-personalization-entry-mount";
    collection.insertAdjacentElement("afterend", mount);
    const frame = window.requestAnimationFrame(() => setHost(mount));
    return () => { window.cancelAnimationFrame(frame); mount.remove(); };
  }, []);

  useEffect(() => {
    const openCustomizer = () => setOpen(true);
    const legacyButtons = new Set<HTMLButtonElement>();
    const legacyHandler = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); setOpen(true); };
    const enhance = () => {
      const desktop = document.querySelector(".desktop-navigation"); if (desktop) createNavigationLink(desktop, openCustomizer);
      const mobile = document.getElementById("mobile-navigation"); if (mobile) createNavigationLink(mobile, openCustomizer, true);
      const legacy = findLegacyConfiguratorButton();
      if (legacy && !legacy.dataset.abagsVisualCustomizer) { legacy.dataset.abagsVisualCustomizer = "true"; legacy.addEventListener("click", legacyHandler, { capture: true }); legacyButtons.add(legacy); }
    };
    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      legacyButtons.forEach((button) => { button.removeEventListener("click", legacyHandler, { capture: true }); delete button.dataset.abagsVisualCustomizer; });
      document.querySelectorAll("[data-abags-personalize-link]").forEach((link) => link.remove());
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.classList.add("abags-vc-open");
    const frame = window.requestAnimationFrame(() => dialogRef.current?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusables = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (focusables.length === 0) { event.preventDefault(); dialogRef.current.focus(); return; }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.classList.remove("abags-vc-open");
      window.removeEventListener("keydown", onKey);
      restoreFocusRef.current?.focus();
    };
  }, [open]);

  const product = products.find((item) => item.id === config.productId) ?? null;
  const stitches = useMemo(() => Array.from(new Set(products.map((item) => item.stitchType.trim()).filter(Boolean))), [products]);
  const stitchOptions = useMemo<Option[]>(() => stitches.map((label) => ({ label, value: slug(label) })), [stitches]);
  const assetsReady = Boolean(config.productId && assetsProductId === config.productId);
  const currentAssets = useMemo(() => assetsReady ? assets.filter((asset) => asset.productId.toLowerCase() === config.productId.toLowerCase()) : [], [assets, assetsReady, config.productId]);
  const assetsByCategory = useMemo(() => {
    const result = new Map<string, Set<string>>();
    for (const asset of currentAssets) { const set = result.get(asset.category) ?? new Set<string>(); set.add(asset.variant); result.set(asset.category, set); }
    return result;
  }, [currentAssets]);
  const layers = useMemo(() => {
    const selected: Array<[CustomizerAsset["category"], string]> = [["color", config.color], ["stitch", config.stitch], ["handles", config.handles], ["hardware", config.hardware], ["strap", config.strap], ["accent", config.accent]];
    return selected.filter(([, variant]) => Boolean(variant)).map(([category, variant]) => currentAssets.find((asset) => asset.category === category && asset.variant === variant)).filter((asset): asset is CustomizerAsset => Boolean(asset));
  }, [currentAssets, config]);
  const labels = useMemo(() => ({ color: labelFor(COLORS, config.color, "kolor"), stitch: labelFor(stitchOptions, config.stitch, "splot"), handles: labelFor(HANDLES, config.handles, "uchwyty"), hardware: labelFor(HARDWARE, config.hardware, "okucia"), strap: labelFor(STRAPS, config.strap, "pasek"), accent: labelFor(ACCENTS, config.accent, "detal") }), [config, stitchOptions]);
  const ready = Boolean(product && config.color && config.stitch && config.handles && config.hardware && config.strap && config.accent);
  const hasLiveLayers = layers.length > 0;
  const summary = product ? `${product.name} · ${labels.color} · ${labels.stitch} · ${labels.handles} · ${labels.hardware} · ${labels.strap} · ${labels.accent}` : "Wybierz model bazowy, aby rozpocząć.";
  const message = product ? `Dzień dobry! Chciałabym zamówić spersonalizowaną A-Bags. Model: ${product.name}. Kolor: ${labels.color}. Splot: ${labels.stitch}. Uchwyty: ${labels.handles}. Okucia: ${labels.hardware}. Pasek: ${labels.strap}. Detal: ${labels.accent}. Proszę o potwierdzenie możliwości wykonania, finalnej ceny i terminu.` : "Dzień dobry! Chciałabym stworzyć własną torebkę A-Bags.";
  const saveDraft = () => { window.localStorage.setItem(DRAFT_KEY, JSON.stringify(config)); setSaved(true); window.setTimeout(() => setSaved(false), 1800); };
  const clearConfig = () => { const first = products[0]; setConfig(first ? { ...EMPTY_CONFIG, productId: first.id, stitch: first.stitchType ? slug(first.stitchType) : "" } : EMPTY_CONFIG); window.localStorage.removeItem(DRAFT_KEY); setShowBase(false); };
  if (!host) return null;

  return <>{createPortal(<section className="abags-personalization-entry" id="personalizacja" aria-labelledby="abags-personalization-title"><div className="abags-personalization-copy"><p className="eyebrow">A-Bags Atelier · Twoja wersja</p><h2 id="abags-personalization-title">Zaprojektuj torebkę i obserwuj wybory na żywo.</h2><p>Wybieraj model, kolor, splot, uchwyty, okucia, pasek i detal. Podgląd zachowuje bazowe zdjęcie produktu 1:1, a przygotowane warianty są nakładane jako niezależne warstwy bez generowania torebki od nowa.</p><button type="button" onClick={() => setOpen(true)}>Uruchom konfigurator <span aria-hidden="true">→</span></button></div><div className="abags-personalization-options" aria-label="Możliwości personalizacji"><span><strong>01</strong> Model i kolor</span><span><strong>02</strong> Splot / ścieg</span><span><strong>03</strong> Uchwyty i pasek</span><span><strong>04</strong> Okucia</span><span><strong>05</strong> Ozdoby</span></div></section>, host)}
  {open && createPortal(<div className="abags-vc-layer-root"><button type="button" className="abags-vc-backdrop" onClick={() => setOpen(false)} aria-label="Zamknij konfigurator" /><section ref={dialogRef} tabIndex={-1} className="abags-vc-dialog" role="dialog" aria-modal="true" aria-labelledby="abags-vc-title"><header className="abags-vc-header"><div><p className="eyebrow">A-Bags Visual Customizer 2.0</p><h2 id="abags-vc-title">Twoja torebka, Twoje detale.</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="Zamknij">×</button></header><div className="abags-vc-layout"><div className="abags-vc-preview-column"><div className="abags-vc-preview" aria-live="polite">
    {product?.imageUrl ? <img className="abags-vc-base" src={product.imageUrl} alt={`Bazowy model ${product.name}`} /> : <div className="abags-vc-empty"><span>◇</span><strong>Wybierz model</strong><p>Tu pojawi się rzeczywisty produkt bazowy.</p></div>}{!showBase && layers.map((asset) => <LayerImage key={`${asset.category}:${asset.variant}:${asset.updatedAt}`} src={asset.imageUrl} />)}{product && <div className="abags-vc-live-badge"><span /> {showBase ? "Widok bazowy" : hasLiveLayers ? `Podgląd na żywo · ${layers.length}` : assetsReady ? "Produkt bazowy" : "Ładowanie warstw…"}</div>}{product && hasLiveLayers && <button type="button" className="abags-vc-compare" onClick={() => setShowBase((current) => !current)}>{showBase ? "Pokaż projekt" : "Porównaj z bazą"}</button>}</div>
    <p className="abags-vc-preview-note">Konfigurator korzysta wyłącznie z warstw przygotowanych dla tego konkretnego produktu. Brak warstwy nie zmienia zdjęcia bazowego i nie deformuje torebki.</p><div className="abags-vc-price"><span>Cena modelu bazowego</span><strong>{product ? money.format(product.price) : "—"}</strong><small>Personalizacja jest wyceniana indywidualnie po potwierdzeniu konfiguracji.</small></div><div className="abags-vc-summary"><strong>Aktualna konfiguracja</strong><p>{summary}</p></div></div>
    <div className="abags-vc-controls"><fieldset><legend>1. Model bazowy</legend><div className="abags-vc-models">{products.map((item) => <button key={item.id} type="button" className={config.productId === item.id ? "is-active" : ""} onClick={() => { setConfig({ ...config, productId: item.id, stitch: item.stitchType ? slug(item.stitchType) : "" }); setShowBase(false); }}><span>{item.imageUrl ? <img src={item.imageUrl} alt="" /> : "◇"}</span><strong>{item.name}</strong><small>{money.format(item.price)}</small></button>)}</div></fieldset>
    <fieldset><legend>2. Kolor</legend><OptionButtons label="Kolor torebki" options={COLORS} value={config.color} availableVariants={assetsByCategory.get("color")} availabilityReady={assetsReady} onChange={(color) => { setConfig({ ...config, color }); setShowBase(false); }} /></fieldset>
    <fieldset><legend>3. Splot / ścieg</legend><OptionButtons label="Splot lub ścieg" options={stitchOptions.length ? stitchOptions : [{ label: "Do ustalenia z pracownią", value: "do-ustalenia" }]} value={config.stitch} availableVariants={assetsByCategory.get("stitch")} availabilityReady={assetsReady} onChange={(stitch) => { setConfig({ ...config, stitch }); setShowBase(false); }} /></fieldset>
    <fieldset><legend>4. Uchwyty</legend><OptionButtons label="Uchwyty" options={HANDLES} value={config.handles} availableVariants={assetsByCategory.get("handles")} availabilityReady={assetsReady} onChange={(handles) => { setConfig({ ...config, handles }); setShowBase(false); }} /></fieldset>
    <fieldset><legend>5. Okucia</legend><OptionButtons label="Kolor okuć" options={HARDWARE} value={config.hardware} availableVariants={assetsByCategory.get("hardware")} availabilityReady={assetsReady} onChange={(hardware) => { setConfig({ ...config, hardware }); setShowBase(false); }} /></fieldset>
    <fieldset><legend>6. Pasek</legend><OptionButtons label="Rodzaj paska" options={STRAPS} value={config.strap} availableVariants={assetsByCategory.get("strap")} availabilityReady={assetsReady} onChange={(strap) => { setConfig({ ...config, strap }); setShowBase(false); }} /></fieldset>
    <fieldset><legend>7. Detal / ozdoba</legend><OptionButtons label="Detal lub ozdoba" options={ACCENTS} value={config.accent} availableVariants={assetsByCategory.get("accent")} availabilityReady={assetsReady} onChange={(accent) => { setConfig({ ...config, accent }); setShowBase(false); }} /></fieldset></div></div>
    <footer className="abags-vc-footer"><button type="button" className="is-secondary" onClick={clearConfig}>Wyczyść</button><button type="button" className="is-secondary" onClick={saveDraft}>{saved ? "Zapisano ✓" : "Zapisz projekt"}</button><a className={ready ? "" : "is-disabled"} href={ready ? whatsappHref(contact.whatsappNumber, message) : undefined} aria-disabled={!ready} target="_blank" rel="noopener noreferrer">Wyślij projekt do pracowni →</a></footer></section></div>, document.body)}</>;
}
