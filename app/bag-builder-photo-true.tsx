"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { EXACT_ATELIER_LIBRARY } from "../lib/exact-customizer-library";

type Product = { id: string; name: string; detail: string; stitchType: string; imageUrl: string | null };
type Category = "color" | "stitch" | "flap" | "handles" | "strap" | "hardware" | "accent";
type Asset = { productId: string; category: Category; variant: string; imageUrl: string; updatedAt: string };
type Config = { family: string; color: string; stitch: string; flap: string; handles: string; strap: string; hardware: string; accent: string };

const STORAGE_KEY = "abags-photo-true-v1";
const LAYER_ORDER: Category[] = ["color", "stitch", "flap", "handles", "strap", "hardware", "accent"];
const EMPTY: Config = { family: "", color: "", stitch: "", flap: "none", handles: "none", strap: "none", hardware: "gold", accent: "none" };

const COLOR_ALIASES: Record<string, string[]> = {
  "#E8DDCC": ["natural-bez", "naturalny-bez", "bez", "kremowy"], "#E4A9B5": ["pudrowy-roz", "roz", "pink"], "#24324D": ["gleboki-granat", "granat", "navy"], "#65493D": ["czekoladowy-braz", "braz", "brown"], "#C7962F": ["musztardowy", "musztarda", "mustard"], "#222124": ["czarny", "black"], "#B93A42": ["czerwony", "red"], "#275C4A": ["butelkowa-zielen", "zielen", "green"], "#087E81": ["turkus", "turkusowy", "teal"], "#A88AE0": ["lawendowy", "lawenda", "lilac"],
};
const VALUE_ALIASES: Record<Exclude<Category, "color">, Record<string, string[]>> = {
  stitch: { classic: ["klasyczny", "classic"], herringbone: ["jodelka", "herringbone"], basket: ["koszykowy", "basket"], shell: ["muszla", "shell"] },
  flap: { none: ["bez-klapy", "none"], crochet: ["szydelkowa", "crochet"], "leather-black": ["skorzana-czarna", "czarna-skora", "leather-black"], "leather-cognac": ["skorzana-koniak", "koniakowa-skora", "leather-cognac"], "suede-burgundy": ["zamszowa-bordo", "bordowy-zamsz", "suede-burgundy"] },
  handles: { none: ["bez-uchwytu", "bez-uchwytow", "none"], "wood-light": ["drewniane-jasne", "drewno-jasne", "drewniane", "wood-light"], "wood-dark": ["drewniane-ciemne", "drewno-ciemne", "wood-dark"], crochet: ["szydelkowe", "szydelkowy", "crochet"] },
  strap: { none: ["bez-paska", "none"], leather: ["skorzany", "regulowany", "leather"], woven: ["tkany", "materialowy", "regulowany", "woven"], chain: ["lancuszek-premium", "lancuszek", "chain"] },
  hardware: { gold: ["zlote", "gold"], silver: ["srebrne", "silver"], black: ["czarne", "black"] },
  accent: { none: ["bez-ozdoby", "none"], tassel: ["chwost", "tassel"], scarf: ["apaszka", "kokarda", "scarf"], charm: ["zawieszka", "charm"] },
};

function readConfig(stage: HTMLElement): Config {
  return { family: stage.dataset.family || "", color: (stage.dataset.color || "").toUpperCase(), stitch: stage.dataset.stitch || "", flap: stage.dataset.flap || "none", handles: stage.dataset.handles || "none", strap: stage.dataset.strap || "none", hardware: stage.dataset.hardware || "gold", accent: stage.dataset.accent || "none" };
}
function sameConfig(a: Config, b: Config) { return (Object.keys(a) as Array<keyof Config>).every((key) => a[key] === b[key]); }
function exactReferenceForImage(imageUrl: string | null) {
  if (!imageUrl) return null;
  try { const pathname = new URL(imageUrl, window.location.origin).pathname; const filename = decodeURIComponent(pathname.split("/").pop() || "").toLowerCase(); return EXACT_ATELIER_LIBRARY.find((item) => item.sourceFile.toLowerCase() === filename) ?? null; }
  catch { const filename = imageUrl.split("?")[0].split("/").pop()?.toLowerCase() || ""; return EXACT_ATELIER_LIBRARY.find((item) => item.sourceFile.toLowerCase() === filename) ?? null; }
}
function inferLegacyFamily(product: Product) { const text = `${product.name} ${product.detail} ${product.stitchType}`.toLowerCase(); if (/\bmini\b|ma[łl]a|small|kopert|crossbody/.test(text)) return "mini"; if (/kube[łl]|bucket|worek|workowa/.test(text)) return "bucket"; if (/okr[aą]g|p[oó][łl]okr[aą]g|round|half.?moon|p[oó][łl]ksi[eę][żz]yc/.test(text)) return "round"; return "tote"; }
function aliases(category: Category, value: string) { if (!value) return []; if (category === "color") return COLOR_ALIASES[value.toUpperCase()] ?? []; return VALUE_ALIASES[category][value] ?? []; }
function matchAsset(assets: Asset[], category: Category, value: string) { const candidates = aliases(category, value); if (!candidates.length) return null; return candidates.map((variant) => assets.find((asset) => asset.category === category && asset.variant === variant)).find(Boolean) ?? null; }
function clickLegacyFamily(family: string) { const button = [...document.querySelectorAll<HTMLButtonElement>('button[data-builder-key="family"]')].find((item) => item.dataset.builderValue === family); button?.click(); }

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
      .then(async (response) => { const payload = await response.json() as { products?: Product[] }; if (!response.ok || !Array.isArray(payload.products)) throw new Error("Nie udało się wczytać modeli A-Bags."); return payload.products.filter((product) => Boolean(product.imageUrl) && Boolean(exactReferenceForImage(product.imageUrl))); })
      .then((items) => { setProducts(items); let saved = ""; try { saved = window.localStorage.getItem(STORAGE_KEY) || ""; } catch {} const initial = items.some((item) => item.id === saved) ? saved : items[0]?.id || ""; setSelectedId((current) => current || initial); })
      .catch(() => setProducts([]));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const attach = () => {
      const dialog = document.querySelector<HTMLElement>(".abags-vc-dialog.abags-reference-layout-v4"); const nextStage = dialog?.querySelector<HTMLElement>(".abags-bag-builder-stage") ?? null; const familyButton = dialog?.querySelector<HTMLButtonElement>('button[data-builder-key="family"]') ?? null; const familyGroup = familyButton?.closest<HTMLElement>("fieldset") ?? null;
      if (!dialog || !nextStage || !familyGroup) return;
      familyGroup.dataset.photoTrueFamilyGroup = "true"; let target = familyGroup.querySelector<HTMLElement>("[data-photo-true-models-mount]");
      if (!target) { target = document.createElement("div"); target.dataset.photoTrueModelsMount = "true"; target.className = "abags-photo-models-mount"; familyGroup.appendChild(target); }
      setMount((current) => current === target ? current : target); setStage((current) => current === nextStage ? current : nextStage); setConfig((current) => { const next = readConfig(nextStage); return sameConfig(current, next) ? current : next; });
    };
    attach(); const observer = new MutationObserver(attach); observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-family", "data-color", "data-stitch", "data-flap", "data-handles", "data-strap", "data-hardware", "data-accent"] }); return () => observer.disconnect();
  }, []);

  const selected = useMemo(() => products.find((product) => product.id === selectedId) ?? null, [products, selectedId]);

  useEffect(() => {
    if (!stage || !selected?.imageUrl) return; const liveStage = document.querySelector<HTMLElement>(".abags-vc-dialog.abags-reference-layout-v4 .abags-bag-builder-stage"); if (!liveStage || liveStage !== stage) return; const dialog = liveStage.closest<HTMLElement>(".abags-vc-dialog.abags-reference-layout-v4"); if (!dialog) return; const family = inferLegacyFamily(selected); const exactReference = exactReferenceForImage(selected.imageUrl); if (!exactReference) return;
    liveStage.dataset.abagsPhotoTrue = "active"; liveStage.dataset.photoProductId = selected.id; liveStage.dataset.photoProductName = selected.name; liveStage.dataset.photoProductImageUrl = selected.imageUrl; liveStage.dataset.photoTrueReferenceId = exactReference.id; liveStage.dataset.photoTrueReferenceSource = exactReference.sourceFile; dialog.dataset.abagsPhotoTrue = "active"; dialog.dataset.photoProductId = selected.id;
    try { window.localStorage.setItem(STORAGE_KEY, selected.id); } catch {} if (liveStage.dataset.family !== family) clickLegacyFamily(family);
    return () => { liveStage.removeAttribute("data-abags-photo-true"); liveStage.removeAttribute("data-photo-product-id"); liveStage.removeAttribute("data-photo-product-name"); liveStage.removeAttribute("data-photo-product-image-url"); liveStage.removeAttribute("data-photo-true-reference-id"); liveStage.removeAttribute("data-photo-true-reference-source"); if (dialog.dataset.photoProductId === selected.id) { dialog.removeAttribute("data-abags-photo-true"); dialog.removeAttribute("data-photo-product-id"); } };
  }, [selected, stage]);

  useEffect(() => {
    if (!selectedId) return; const controller = new AbortController(); fetch(`/api/customizer-assets?productId=${encodeURIComponent(selectedId)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => { const payload = await response.json() as { assets?: Asset[]; error?: string }; if (!response.ok || !Array.isArray(payload.assets)) throw new Error(payload.error || "Nie udało się wczytać warstw 1:1."); return payload.assets; })
      .then((items) => { setAssets(items); setAssetError(""); })
      .catch((reason) => { if (!controller.signal.aborted) { setAssets([]); setAssetError(reason instanceof Error ? reason.message : "Nie udało się wczytać warstw 1:1."); } });
    return () => controller.abort();
  }, [selectedId]);

  useEffect(() => {
    if (!stage) return; const sync = () => setConfig((current) => { const next = readConfig(stage); return sameConfig(current, next) ? current : next; }); sync(); const observer = new MutationObserver(sync); observer.observe(stage, { attributes: true, attributeFilter: ["data-family", "data-color", "data-stitch", "data-flap", "data-handles", "data-strap", "data-hardware", "data-accent"] }); return () => observer.disconnect();
  }, [stage]);

  useEffect(() => {
    if (!stage) return; const image = stage.querySelector<HTMLImageElement>(".abags-photo-true-base"); if (!image || !selected?.imageUrl) return; image.src = selected.imageUrl; image.alt = `${selected.name} — rzeczywiste zdjęcie produktu A-Bags Handmade`;
    const syncReady = () => { const liveStage = document.querySelector<HTMLElement>(".abags-vc-dialog.abags-reference-layout-v4 .abags-bag-builder-stage"); if (!liveStage) return; liveStage.dataset.photoTrueReady = image.naturalWidth > 0 && image.naturalHeight > 0 ? "true" : "false"; };
    image.onload = syncReady; if (image.complete) syncReady(); return () => { image.onload = null; };
  }, [selected, stage]);

  const exactReference = useMemo(() => exactReferenceForImage(selected?.imageUrl ?? null), [selected]);
  const rendered = useMemo(() => { const base = selected?.imageUrl || ""; const layers = LAYER_ORDER.map((category) => matchAsset(assets, category, config[category])).filter((asset): asset is Asset => Boolean(asset)); return { base, layers }; }, [assets, config, selected]);
  if (!mount || !selected || !exactReference) return null;

  return createPortal(
    <div className="abags-photo-true-panel" data-photo-true-panel="true">
      <div className="abags-photo-true-stage" aria-label="Rzeczywiste zdjęcie produktu 1:1">
        <img className="abags-photo-true-base" src={rendered.base} alt={`${selected.name} — rzeczywiste zdjęcie produktu A-Bags Handmade`} />
        {rendered.layers.map((layer) => <img key={`${layer.category}-${layer.variant}`} className={`abags-photo-true-layer abags-photo-true-layer-${layer.category}`} src={layer.imageUrl} alt="" aria-hidden="true" />)}
        <span className="abags-photo-true-badge">PHOTO-TRUE 1:1</span>
      </div>
      <div className="abags-photo-true-note">Rzeczywiste zdjęcie referencyjne: {exactReference.sourceFile}. Tryb fotograficzny pokazuje wyłącznie produkty z kanonicznej biblioteki Exact Live.{assetError ? ` ${assetError}` : ""}</div>
      <div className="abags-photo-models-grid" role="list">
        {products.map((product) => { const reference = exactReferenceForImage(product.imageUrl); if (!reference) return null; return (
          <button key={product.id} type="button" data-photo-product-choice={product.id} aria-pressed={product.id === selectedId} onClick={() => setSelectedId(product.id)} title={reference.label}>
            <img src={product.imageUrl || ""} alt={product.name} loading="eager" /><span>{product.name}</span>
          </button>
        ); })}
      </div>
    </div>, mount,
  );
}
