"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { usePublicContact, whatsappHref } from "./public-contact";

const PERSONALIZE_LABEL = "Personalizuj torebkę";
const DRAFT_KEY = "abags-customizer-draft-v2";

type Product = {
  id: string;
  name: string;
  detail: string;
  stitchType: string;
  price: number;
  imageUrl: string | null;
};

type Config = {
  productId: string;
  color: string;
  stitch: string;
  handles: string;
  hardware: string;
  strap: string;
  accent: string;
};

type Option = { label: string; value: string; price: number; swatch?: string };

const COLORS: Option[] = [
  { label: "Naturalny beż", value: "natural-bez", price: 0, swatch: "#d8c3a8" },
  { label: "Pudrowy róż", value: "pudrowy-roz", price: 0, swatch: "#d9a3aa" },
  { label: "Głęboki granat", value: "gleboki-granat", price: 0, swatch: "#24324d" },
  { label: "Czekoladowy brąz", value: "czekoladowy-braz", price: 0, swatch: "#65493d" },
  { label: "Musztardowy", value: "musztardowy", price: 0, swatch: "#c7962f" },
  { label: "Czarny", value: "czarny", price: 0, swatch: "#242224" },
];

const HANDLES: Option[] = [
  { label: "Klasyczne", value: "klasyczne", price: 0 },
  { label: "Drewniane", value: "drewniane", price: 25 },
  { label: "Łańcuszek", value: "lancuszek", price: 35 },
];

const HARDWARE: Option[] = [
  { label: "Złote", value: "zlote", price: 0, swatch: "#b9944d" },
  { label: "Srebrne", value: "srebrne", price: 0, swatch: "#bfc2c6" },
  { label: "Czarne", value: "czarne", price: 0, swatch: "#302e30" },
];

const STRAPS: Option[] = [
  { label: "Bez dodatkowego paska", value: "bez-paska", price: 0 },
  { label: "Regulowany", value: "regulowany", price: 25 },
  { label: "Łańcuszek premium", value: "lancuszek-premium", price: 40 },
];

const ACCENTS: Option[] = [
  { label: "Bez ozdoby", value: "bez-ozdoby", price: 0 },
  { label: "Chwost", value: "chwost", price: 15 },
  { label: "Apaszka / kokarda", value: "apaszka", price: 20 },
  { label: "Zawieszka", value: "zawieszka", price: 15 },
];

const money = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" });

const EMPTY_CONFIG: Config = {
  productId: "",
  color: "",
  stitch: "",
  handles: "",
  hardware: "",
  strap: "",
  accent: "",
};

function slug(value: string) {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function sanitizeConfig(value: unknown): Config {
  if (!value || typeof value !== "object") return EMPTY_CONFIG;
  const candidate = value as Partial<Record<keyof Config, unknown>>;
  return Object.fromEntries(
    (Object.keys(EMPTY_CONFIG) as (keyof Config)[]).map((key) => [key, typeof candidate[key] === "string" ? candidate[key] : ""]),
  ) as Config;
}

function restoreDraft(): Config {
  if (typeof window === "undefined") return EMPTY_CONFIG;
  try {
    const stored = window.localStorage.getItem(DRAFT_KEY);
    return stored ? sanitizeConfig(JSON.parse(stored)) : EMPTY_CONFIG;
  } catch {
    window.localStorage.removeItem(DRAFT_KEY);
    return EMPTY_CONFIG;
  }
}

function labelFor(options: Option[], value: string, fallback = "—") {
  return options.find((option) => option.value === value)?.label ?? (value || fallback);
}

function findLegacyConfiguratorButton() {
  return Array.from(document.querySelectorAll<HTMLButtonElement>(".abags-experience-actions > button"))
    .find((button) => button.textContent?.includes("Stwórz własną torebkę"));
}

function createNavigationLink(container: Element, onOpen: () => void, mobile = false) {
  if (container.querySelector("[data-abags-personalize-link]")) return;
  const link = document.createElement("a");
  link.href = "#personalizacja";
  link.dataset.abagsPersonalizeLink = "true";
  link.className = mobile ? "abags-personalize-nav-link abags-personalize-nav-link-mobile" : "abags-personalize-nav-link";
  link.textContent = PERSONALIZE_LABEL;
  link.setAttribute("aria-label", "Otwórz wizualny konfigurator personalizacji torebki");
  link.addEventListener("click", (event) => {
    event.preventDefault();
    if (mobile) document.querySelector<HTMLButtonElement>(".menu-button[aria-expanded='true']")?.click();
    onOpen();
  });
  if (mobile) container.insertBefore(link, container.firstChild);
  else container.appendChild(link);
}

function OptionButtons({ options, value, onChange, label }: { options: Option[]; value: string; onChange: (value: string) => void; label: string }) {
  return <div className="abags-vc-options" role="group" aria-label={label}>
    {options.map((option) => <button key={option.value} type="button" className={value === option.value ? "is-active" : ""} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
      {option.swatch && <span className="abags-vc-swatch" style={{ background: option.swatch }} aria-hidden="true" />}
      <span>{option.label}</span>
      {option.price > 0 && <small>+{money.format(option.price)}</small>}
    </button>)}
  </div>;
}

function LayerImage({ src }: { src: string }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return <img className="abags-vc-layer" src={src} alt="" aria-hidden="true" onError={() => setVisible(false)} />;
}

export default function PersonalizationEntry() {
  const contact = usePublicContact();
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [config, setConfig] = useState<Config>(restoreDraft);
  const [saved, setSaved] = useState(false);
  const [showBase, setShowBase] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/products", { cache: "no-store", signal: controller.signal })
      .then(async (response) => response.ok ? response.json() : Promise.reject(new Error("products unavailable")))
      .then((data: { products?: Product[] }) => {
        const items = Array.isArray(data.products) ? data.products : [];
        setProducts(items);
        if (items.length === 0) return;
        setConfig((current) => {
          if (current.productId && items.some((item) => item.id === current.productId)) return current;
          const first = items[0];
          return { ...current, productId: first.id, stitch: first.stitchType ? slug(first.stitchType) : current.stitch };
        });
      })
      .catch(() => { if (!controller.signal.aborted) setProducts([]); });
    return () => controller.abort();
  }, []);

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
    const legacyHandler = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      setOpen(true);
    };
    const enhance = () => {
      const desktop = document.querySelector(".desktop-navigation");
      if (desktop) createNavigationLink(desktop, openCustomizer);
      const mobile = document.getElementById("mobile-navigation");
      if (mobile) createNavigationLink(mobile, openCustomizer, true);
      const legacy = findLegacyConfiguratorButton();
      if (legacy && !legacy.dataset.abagsVisualCustomizer) {
        legacy.dataset.abagsVisualCustomizer = "true";
        legacy.addEventListener("click", legacyHandler, { capture: true });
        legacyButtons.add(legacy);
      }
    };
    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      legacyButtons.forEach((button) => {
        button.removeEventListener("click", legacyHandler, { capture: true });
        delete button.dataset.abagsVisualCustomizer;
      });
      document.querySelectorAll("[data-abags-personalize-link]").forEach((link) => link.remove());
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("modal-open", open);
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    if (open) window.addEventListener("keydown", onKey);
    return () => { document.body.classList.remove("modal-open"); window.removeEventListener("keydown", onKey); };
  }, [open]);

  const product = products.find((item) => item.id === config.productId) ?? null;
  const stitches = useMemo(() => Array.from(new Set(products.map((item) => item.stitchType.trim()).filter(Boolean))), [products]);
  const stitchOptions = useMemo<Option[]>(() => stitches.map((label) => ({ label, value: slug(label), price: 0 })), [stitches]);

  const optionPrice = useMemo(() => {
    const groups = [HANDLES, HARDWARE, STRAPS, ACCENTS];
    const values = [config.handles, config.hardware, config.strap, config.accent];
    return groups.reduce((sum, group, index) => sum + (group.find((option) => option.value === values[index])?.price ?? 0), 0);
  }, [config]);
  const previewPrice = (product?.price ?? 0) + optionPrice;

  const layers = useMemo(() => {
    if (!product) return [] as string[];
    const productSlug = slug(product.id || product.name);
    return [
      config.color && `/images/configurator/${productSlug}/color/${config.color}.png`,
      config.stitch && `/images/configurator/${productSlug}/stitch/${config.stitch}.png`,
      config.handles && `/images/configurator/${productSlug}/handles/${config.handles}.png`,
      config.hardware && `/images/configurator/${productSlug}/hardware/${config.hardware}.png`,
      config.strap && `/images/configurator/${productSlug}/strap/${config.strap}.png`,
      config.accent && `/images/configurator/${productSlug}/accent/${config.accent}.png`,
    ].filter(Boolean) as string[];
  }, [product, config]);

  const labels = useMemo(() => ({
    color: labelFor(COLORS, config.color, "kolor"),
    stitch: labelFor(stitchOptions, config.stitch, "splot"),
    handles: labelFor(HANDLES, config.handles, "uchwyty"),
    hardware: labelFor(HARDWARE, config.hardware, "okucia"),
    strap: labelFor(STRAPS, config.strap, "pasek"),
    accent: labelFor(ACCENTS, config.accent, "detal"),
  }), [config, stitchOptions]);

  const ready = Boolean(product && config.color && config.stitch && config.handles && config.hardware && config.strap && config.accent);
  const summary = product ? `${product.name} · ${labels.color} · ${labels.stitch} · ${labels.handles} · ${labels.hardware} · ${labels.strap} · ${labels.accent}` : "Wybierz model bazowy, aby rozpocząć.";
  const message = product ? `Dzień dobry! Chciałabym zamówić spersonalizowaną A-Bags. Model: ${product.name}. Kolor: ${labels.color}. Splot: ${labels.stitch}. Uchwyty: ${labels.handles}. Okucia: ${labels.hardware}. Pasek: ${labels.strap}. Detal: ${labels.accent}. Orientacyjna cena konfiguracji: ${money.format(previewPrice)}. Proszę o potwierdzenie możliwości wykonania, finalnej ceny i terminu.` : "Dzień dobry! Chciałabym stworzyć własną torebkę A-Bags.";

  const saveDraft = () => {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(config));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const clearConfig = () => {
    const first = products[0];
    setConfig(first ? { ...EMPTY_CONFIG, productId: first.id, stitch: first.stitchType ? slug(first.stitchType) : "" } : EMPTY_CONFIG);
    window.localStorage.removeItem(DRAFT_KEY);
    setShowBase(false);
  };

  if (!host) return null;

  return <>
    {createPortal(<section className="abags-personalization-entry" id="personalizacja" aria-labelledby="abags-personalization-title">
      <div className="abags-personalization-copy">
        <p className="eyebrow">A-Bags Atelier · Twoja wersja</p>
        <h2 id="abags-personalization-title">Zaprojektuj torebkę i obserwuj wybory na żywo.</h2>
        <p>Wybieraj model, kolor, splot, uchwyty, okucia, pasek i detal. Podgląd zachowuje bazowe zdjęcie produktu 1:1, a przygotowane warianty są nakładane jako niezależne warstwy bez generowania torebki od nowa.</p>
        <button type="button" onClick={() => setOpen(true)}>Uruchom konfigurator <span aria-hidden="true">→</span></button>
      </div>
      <div className="abags-personalization-options" aria-label="Możliwości personalizacji">
        <span><strong>01</strong> Model i kolor</span><span><strong>02</strong> Splot / ścieg</span><span><strong>03</strong> Uchwyty i pasek</span><span><strong>04</strong> Okucia</span><span><strong>05</strong> Ozdoby</span>
      </div>
    </section>, host)}

    {open && createPortal(<div className="abags-vc-layer-root">
      <button type="button" className="abags-vc-backdrop" onClick={() => setOpen(false)} aria-label="Zamknij konfigurator" />
      <section className="abags-vc-dialog" role="dialog" aria-modal="true" aria-labelledby="abags-vc-title">
        <header className="abags-vc-header"><div><p className="eyebrow">A-Bags Visual Customizer 2.0</p><h2 id="abags-vc-title">Twoja torebka, Twoje detale.</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="Zamknij">×</button></header>
        <div className="abags-vc-layout">
          <div className="abags-vc-preview-column">
            <div className="abags-vc-preview" aria-live="polite">
              {product?.imageUrl ? <img className="abags-vc-base" src={product.imageUrl} alt={`Bazowy model ${product.name}`} /> : <div className="abags-vc-empty"><span>◇</span><strong>Wybierz model</strong><p>Tu pojawi się rzeczywisty produkt bazowy.</p></div>}
              {!showBase && layers.map((src) => <LayerImage key={src} src={src} />)}
              {product && <div className="abags-vc-live-badge"><span /> {showBase ? "Widok bazowy" : "Podgląd na żywo"}</div>}
              {product && <button type="button" className="abags-vc-compare" onClick={() => setShowBase((current) => !current)}>{showBase ? "Pokaż projekt" : "Porównaj z bazą"}</button>}
            </div>
            <p className="abags-vc-preview-note">Zmiana wizualna pojawia się tylko wtedy, gdy dla wybranego wariantu istnieje przygotowana warstwa produktu. W przeciwnym razie zdjęcie bazowe pozostaje nienaruszone 1:1.</p>
            <div className="abags-vc-price"><span>Orientacyjna cena</span><strong>{product ? money.format(previewPrice) : "—"}</strong><small>Finalną cenę i dostępność potwierdza pracownia.</small></div>
            <div className="abags-vc-summary"><strong>Aktualna konfiguracja</strong><p>{summary}</p></div>
          </div>

          <div className="abags-vc-controls">
            <fieldset><legend>1. Model bazowy</legend><div className="abags-vc-models">{products.map((item) => <button key={item.id} type="button" className={config.productId === item.id ? "is-active" : ""} onClick={() => { setConfig({ ...config, productId: item.id, stitch: item.stitchType ? slug(item.stitchType) : "" }); setShowBase(false); }}><span>{item.imageUrl ? <img src={item.imageUrl} alt="" /> : "◇"}</span><strong>{item.name}</strong><small>{money.format(item.price)}</small></button>)}</div></fieldset>
            <fieldset><legend>2. Kolor</legend><OptionButtons label="Kolor torebki" options={COLORS} value={config.color} onChange={(color) => { setConfig({ ...config, color }); setShowBase(false); }} /></fieldset>
            <fieldset><legend>3. Splot / ścieg</legend><OptionButtons label="Splot lub ścieg" options={stitchOptions.length ? stitchOptions : [{ label: "Do ustalenia z pracownią", value: "do-ustalenia", price: 0 }]} value={config.stitch} onChange={(stitch) => { setConfig({ ...config, stitch }); setShowBase(false); }} /></fieldset>
            <fieldset><legend>4. Uchwyty</legend><OptionButtons label="Uchwyty" options={HANDLES} value={config.handles} onChange={(handles) => { setConfig({ ...config, handles }); setShowBase(false); }} /></fieldset>
            <fieldset><legend>5. Okucia</legend><OptionButtons label="Kolor okuć" options={HARDWARE} value={config.hardware} onChange={(hardware) => { setConfig({ ...config, hardware }); setShowBase(false); }} /></fieldset>
            <fieldset><legend>6. Pasek</legend><OptionButtons label="Rodzaj paska" options={STRAPS} value={config.strap} onChange={(strap) => { setConfig({ ...config, strap }); setShowBase(false); }} /></fieldset>
            <fieldset><legend>7. Detal / ozdoba</legend><OptionButtons label="Detal lub ozdoba" options={ACCENTS} value={config.accent} onChange={(accent) => { setConfig({ ...config, accent }); setShowBase(false); }} /></fieldset>
          </div>
        </div>
        <footer className="abags-vc-footer"><button type="button" className="is-secondary" onClick={clearConfig}>Wyczyść</button><button type="button" className="is-secondary" onClick={saveDraft}>{saved ? "Zapisano ✓" : "Zapisz projekt"}</button><a className={ready ? "" : "is-disabled"} href={ready ? whatsappHref(contact.whatsappNumber, message) : undefined} aria-disabled={!ready} target="_blank" rel="noopener noreferrer">Wyślij projekt do pracowni →</a></footer>
      </section>
    </div>, document.body)}
  </>;
}
