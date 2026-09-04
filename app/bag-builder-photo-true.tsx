"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type Product = {
  id: string;
  name: string;
  detail: string;
  stitchType: string;
  imageUrl: string | null;
};

type Category = "color" | "stitch" | "flap" | "handles" | "strap" | "hardware" | "accent";
type Asset = {
  productId: string;
  category: Category;
  variant: string;
  imageUrl: string;
  updatedAt: string;
};

type Config = {
  family: string;
  color: string;
  stitch: string;
  flap: string;
  handles: string;
  strap: string;
  hardware: string;
  accent: string;
};

const STORAGE_KEY = "abags-photo-true-v1";
const LAYER_ORDER: Category[] = ["color", "stitch", "flap", "handles", "strap", "hardware", "accent"];
const EMPTY: Config = { family: "", color: "", stitch: "", flap: "none", handles: "none", strap: "none", hardware: "gold", accent: "none" };

const COLOR_ALIASES: Record<string, string[]> = {
  "#E8DDCC": ["natural-bez", "naturalny-bez", "bez", "kremowy"],
  "#E4A9B5": ["pudrowy-roz", "roz", "pink"],
  "#24324D": ["gleboki-granat", "granat", "navy"],
  "#65493D": ["czekoladowy-braz", "braz", "brown"],
  "#C7962F": ["musztardowy", "musztarda", "mustard"],
  "#222124": ["czarny", "black"],
  "#B93A42": ["czerwony", "red"],
  "#275C4A": ["butelkowa-zielen", "zielen", "green"],
  "#087E81": ["turkus", "turkusowy", "teal"],
  "#A88AE0": ["lawendowy", "lawenda", "lilac"],
};

const VALUE_ALIASES: Record<Exclude<Category, "color">, Record<string, string[]>> = {
  stitch: {
    classic: ["klasyczny", "classic"],
    herringbone: ["jodelka", "herringbone"],
    basket: ["koszykowy", "basket"],
    shell: ["muszla", "shell"],
  },
  flap: {
    none: ["bez-klapy", "none"],
    crochet: ["szydelkowa", "crochet"],
    "leather-black": ["skorzana-czarna", "czarna-skora", "leather-black"],
    "leather-cognac": ["skorzana-koniak", "koniakowa-skora", "leather-cognac"],
    "suede-burgundy": ["zamszowa-bordo", "bordowy-zamsz", "suede-burgundy"],
  },
  handles: {
    none: ["bez-uchwytu", "bez-uchwytow", "none"],
    "wood-light": ["drewniane-jasne", "drewno-jasne", "drewniane", "wood-light"],
    "wood-dark": ["drewniane-ciemne", "drewno-ciemne", "wood-dark"],
    crochet: ["szydelkowe", "szydelkowy", "crochet"],
  },
  strap: {
    none: ["bez-paska", "none"],
    leather: ["skorzany", "regulowany", "leather"],
    woven: ["tkany", "materialowy", "regulowany", "woven"],
    chain: ["lancuszek-premium", "lancuszek", "chain"],
  },
  hardware: {
    gold: ["zlote", "gold"],
    silver: ["srebrne", "silver"],
    black: ["czarne", "black"],
  },
  accent: {
    none: ["bez-ozdoby", "none"],
    tassel: ["chwost", "tassel"],
    scarf: ["apaszka", "kokarda", "scarf"],
    charm: ["zawieszka", "charm"],
  },
};

const CATEGORY_LABELS: Record<Category, string> = {
  color: "kolor",
  stitch: "splot",
  flap: "klapa",
  handles: "uchwyt",
  strap: "pasek",
  hardware: "okucia",
  accent: "dodatek",
};

function readConfig(stage: HTMLElement): Config {
  return {
    family: stage.dataset.family || "",
    color: (stage.dataset.color || "").toUpperCase(),
    stitch: stage.dataset.stitch || "",
    flap: stage.dataset.flap || "none",
    handles: stage.dataset.handles || "none",
    strap: stage.dataset.strap || "none",
    hardware: stage.dataset.hardware || "gold",
    accent: stage.dataset.accent || "none",
  };
}

function sameConfig(a: Config, b: Config) {
  return (Object.keys(a) as Array<keyof Config>).every((key) => a[key] === b[key]);
}

function inferLegacyFamily(product: Product) {
  const text = `${product.name} ${product.detail} ${product.stitchType}`.toLowerCase();
  if (/\bmini\b|ma[łl]a|small|kopert|crossbody/.test(text)) return "mini";
  if (/kube[łl]|bucket|worek|workowa/.test(text)) return "bucket";
  if (/okr[aą]g|p[oó][łl]okr[aą]g|round|half.?moon|p[oó][łl]ksi[eę][żz]yc/.test(text)) return "round";
  return "tote";
}

function aliases(category: Category, value: string) {
  if (!value) return [];
  if (category === "color") return COLOR_ALIASES[value.toUpperCase()] ?? [];
  return VALUE_ALIASES[category][value] ?? [];
}

function matchAsset(assets: Asset[], category: Category, value: string) {
  const candidates = aliases(category, value);
  if (!candidates.length) return null;
  return candidates.map((variant) => assets.find((asset) => asset.category === category && asset.variant === variant)).find(Boolean) ?? null;
}

function clickLegacyFamily(family: string) {
  const button = [...document.querySelectorAll<HTMLButtonElement>('button[data-builder-key="family"]')]
    .find((item) => item.dataset.builderValue === family);
  button?.click();
}

export default function BagBuilderPhotoTrue() {
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [stage, setStage] = useState<HTMLElement | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [config, setConfig] = useState<Config>(EMPTY);
  const [assetError, setAssetError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/products", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { products?: Product[] };
        if (!response.ok || !Array.isArray(payload.products)) throw new Error("Nie udało się wczytać modeli A-Bags.");
        return payload.products.filter((product) => Boolean(product.imageUrl));
      })
      .then((items) => {
        setProducts(items);
        let saved = "";
        try { saved = window.localStorage.getItem(STORAGE_KEY) || ""; } catch {}
        const initial = items.some((item) => item.id === saved) ? saved : items[0]?.id || "";
        setSelectedId((current) => current || initial);
      })
      .catch(() => setProducts([]));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const attach = () => {
      const dialog = document.querySelector<HTMLElement>(".abags-vc-dialog.abags-reference-layout-v4");
      const nextStage = dialog?.querySelector<HTMLElement>(".abags-bag-builder-stage") ?? null;
      const familyButton = dialog?.querySelector<HTMLButtonElement>('button[data-builder-key="family"]') ?? null;
      const familyGroup = familyButton?.closest<HTMLElement>("fieldset") ?? null;
      if (!dialog || !nextStage || !familyGroup) return;
      familyGroup.dataset.photoTrueFamilyGroup = "true";
      let target = familyGroup.querySelector<HTMLElement>("[data-photo-true-models-mount]");
      if (!target) {
        target = document.createElement("div");
        target.dataset.photoTrueModelsMount = "true";
        target.className = "abags-photo-models-mount";
        familyGroup.appendChild(target);
      }
      setMount((current) => current === target ? current : target);
      setStage((current) => current === nextStage ? current : nextStage);
      setConfig((current) => {
        const next = readConfig(nextStage);
        return sameConfig(current, next) ? current : next;
      });
    };
    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-family", "data-color", "data-stitch", "data-flap", "data-handles", "data-strap", "data-hardware", "data-accent"] });
    return () => observer.disconnect();
  }, []);

  const selected = useMemo(() => products.find((product) => product.id === selectedId) ?? null, [products, selectedId]);

  useEffect(() => {
    if (!stage || !selected?.imageUrl) return;
    const dialog = stage.closest<HTMLElement>(".abags-vc-dialog");
    const family = inferLegacyFamily(selected);
    stage.dataset.abagsPhotoTrue = "active";
    stage.dataset.photoProductId = selected.id;
    stage.dataset.photoProductName = selected.name;
    dialog?.setAttribute("data-abags-photo-true", "active");
    dialog?.setAttribute("data-photo-product-id", selected.id);
    try { window.localStorage.setItem(STORAGE_KEY, selected.id); } catch {}
    if (stage.dataset.family !== family) clickLegacyFamily(family);
    return () => {
      stage.removeAttribute("data-abags-photo-true");
      stage.removeAttribute("data-photo-product-id");
      stage.removeAttribute("data-photo-product-name");
      dialog?.removeAttribute("data-abags-photo-true");
      dialog?.removeAttribute("data-photo-product-id");
    };
  }, [stage, selected]);

  useEffect(() => {
    if (!selectedId) { setAssets([]); return; }
    const controller = new AbortController();
    setAssetError("");
    fetch(`/api/customizer-assets?productId=${encodeURIComponent(selectedId)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { assets?: Asset[]; error?: string };
        if (!response.ok || !Array.isArray(payload.assets)) throw new Error(payload.error || "Nie udało się wczytać warstw 1:1.");
        return payload.assets;
      })
      .then(setAssets)
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setAssets([]);
          setAssetError(reason instanceof Error ? reason.message : "Nie udało się wczytać warstw 1:1.");
        }
      });
    return () => controller.abort();
  }, [selectedId]);

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
    if (!stage || !selected) return;
    const controls = stage.closest<HTMLElement>(".abags-vc-dialog")?.querySelector<HTMLElement>(".abags-builder-controls");
    if (!controls) return;
    controls.querySelectorAll<HTMLButtonElement>("button[data-builder-key]").forEach((button) => {
      const category = button.dataset.builderKey as Category | "family" | undefined;
      if (!category || category === "family" || !LAYER_ORDER.includes(category)) return;
      const value = button.dataset.builderValue || "";
      const exact = Boolean(matchAsset(assets, category, category === "color" ? value.toUpperCase() : value));
      button.dataset.photoExact = exact ? "true" : "false";
      if (!exact) button.title = "Ten wariant nie ma jeszcze przygotowanej warstwy fotograficznej 1:1 dla tego modelu.";
      else if (button.title.includes("warstwy fotograficznej")) button.removeAttribute("title");
    });
  }, [assets, selected, stage]);

  const layers = useMemo(() => LAYER_ORDER.map((category) => {
    const value = config[category];
    const asset = matchAsset(assets, category, value);
    return { category, value, asset };
  }), [assets, config]);

  const activeLayers = layers.filter((item) => item.asset);
  const missing = layers.filter((item) => item.value && !item.asset && !(["flap", "handles", "strap", "accent"].includes(item.category) && item.value === "none"));

  if (!mount || !stage || !selected?.imageUrl || products.length === 0) return null;

  return <>
    {createPortal(
      <section className="abags-photo-models" aria-label="Rzeczywiste fasony A-Bags" data-photo-true-model-count={products.length}>
        <div className="abags-photo-models-head"><div><strong>Rzeczywiste modele A‑Bags</strong><small>Wybierz bazę 1:1 ze zdjęcia produktu</small></div><span>{products.length}</span></div>
        <div className="abags-photo-models-grid">
          {products.map((product) => <button key={product.id} type="button" className={product.id === selected.id ? "is-active" : ""} aria-pressed={product.id === selected.id} onClick={() => setSelectedId(product.id)} data-photo-product-choice={product.id}>
            <span className="abags-photo-model-thumb"><img src={product.imageUrl ?? ""} alt="" loading={product.id === selected.id ? "eager" : "lazy"} draggable={false} /></span>
            <span className="abags-photo-model-copy"><strong>{product.name}</strong><small>{product.detail || product.stitchType || "Rzeczywisty produkt A-Bags"}</small></span>
          </button>)}
        </div>
      </section>,
      mount,
    )}

    {createPortal(
      <div className="abags-photo-true-stage" data-photo-true-product={selected.id} data-photo-true-ready="true">
        <img className="abags-photo-true-base" src={selected.imageUrl} alt={`Podgląd 1:1: ${selected.name}`} draggable={false} />
        {activeLayers.map(({ category, asset }) => asset && <img key={`${category}:${asset.variant}:${asset.updatedAt}`} className="abags-photo-true-overlay" data-photo-layer={category} data-photo-variant={asset.variant} src={asset.imageUrl} alt="" aria-hidden="true" draggable={false} />)}
        <div className="abags-photo-true-badge"><strong>PHOTO‑TRUE 1:1</strong><span>{selected.name}</span></div>
        {(missing.length > 0 || assetError) && <div className="abags-photo-true-note" role="status">
          <strong>Podgląd bez sztucznego domalowywania</strong>
          <span>{assetError || `Brak warstwy 1:1: ${missing.map((item) => CATEGORY_LABELS[item.category]).join(", ")}. Wybór pozostaje w projekcie, ale zdjęcie nie jest fałszowane.`}</span>
        </div>}
      </div>,
      stage,
    )}
  </>;
}
