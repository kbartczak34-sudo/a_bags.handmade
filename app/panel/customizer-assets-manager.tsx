"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import "./customizer-assets-coverage.css";

type Product = {
  id: string;
  name: string;
  imageUrl: string | null;
};

type Asset = {
  productId: string;
  category: string;
  variant: string;
  imageUrl: string;
  updatedAt: string;
};

type PresetVariant = { label: string; value: string };

const CATEGORIES = [
  ["color", "Kolor"],
  ["stitch", "Splot / ścieg"],
  ["flap", "Klapa / zapięcie"],
  ["handles", "Uchwyty"],
  ["hardware", "Okucia"],
  ["strap", "Pasek"],
  ["accent", "Detal / ozdoba"],
] as const;

const PRESET_VARIANTS: Record<string, PresetVariant[]> = {
  color: [
    { label: "Naturalny beż", value: "natural-bez" },
    { label: "Pudrowy róż", value: "pudrowy-roz" },
    { label: "Głęboki granat", value: "gleboki-granat" },
    { label: "Czekoladowy brąz", value: "czekoladowy-braz" },
    { label: "Musztardowy", value: "musztardowy" },
    { label: "Czarny", value: "czarny" },
    { label: "Czerwony", value: "czerwony" },
    { label: "Butelkowa zieleń", value: "butelkowa-zielen" },
    { label: "Turkus", value: "turkus" },
    { label: "Lawendowy", value: "lawendowy" },
  ],
  stitch: [
    { label: "Klasyczny", value: "klasyczny" },
    { label: "Jodełka", value: "jodelka" },
    { label: "Koszykowy", value: "koszykowy" },
    { label: "Muszla", value: "muszla" },
  ],
  flap: [
    { label: "Bez klapy", value: "bez-klapy" },
    { label: "Szydełkowa", value: "szydelkowa" },
    { label: "Skórzana czarna", value: "skorzana-czarna" },
    { label: "Skórzana koniak", value: "skorzana-koniak" },
    { label: "Zamszowa bordo", value: "zamszowa-bordo" },
  ],
  handles: [
    { label: "Bez uchwytu", value: "bez-uchwytu" },
    { label: "Drewniane jasne", value: "drewniane-jasne" },
    { label: "Drewniane ciemne", value: "drewniane-ciemne" },
    { label: "Szydełkowe", value: "szydelkowe" },
  ],
  hardware: [
    { label: "Złote", value: "zlote" },
    { label: "Srebrne", value: "srebrne" },
    { label: "Czarne", value: "czarne" },
  ],
  strap: [
    { label: "Bez dodatkowego paska", value: "bez-paska" },
    { label: "Skórzany", value: "skorzany" },
    { label: "Tkany", value: "tkany" },
    { label: "Łańcuszek premium", value: "lancuszek-premium" },
  ],
  accent: [
    { label: "Bez ozdoby", value: "bez-ozdoby" },
    { label: "Chwost", value: "chwost" },
    { label: "Apaszka / kokarda", value: "apaszka" },
    { label: "Zawieszka", value: "zawieszka" },
  ],
};

// These choices intentionally keep the photographed base and therefore do not require
// a separate transparent overlay in the current Photo-True contract.
const BASE_PREVIEW_VARIANTS = new Set([
  "flap:bez-klapy",
  "handles:bez-uchwytu",
  "strap:bez-paska",
  "accent:bez-ozdoby",
]);

// Accepted aliases mirror the public Photo-True renderer so the coverage panel also
// understands older layers saved before canonical admin keys were introduced.
const PREVIEW_ALIASES: Record<string, string[]> = {
  "color:natural-bez": ["natural-bez", "naturalny-bez", "bez", "kremowy"],
  "color:pudrowy-roz": ["pudrowy-roz", "roz", "pink"],
  "color:gleboki-granat": ["gleboki-granat", "granat", "navy"],
  "color:czekoladowy-braz": ["czekoladowy-braz", "braz", "brown"],
  "color:musztardowy": ["musztardowy", "musztarda", "mustard"],
  "color:czarny": ["czarny", "black"],
  "color:czerwony": ["czerwony", "red"],
  "color:butelkowa-zielen": ["butelkowa-zielen", "zielen", "green"],
  "color:turkus": ["turkus", "turkusowy", "teal"],
  "color:lawendowy": ["lawendowy", "lawenda", "lilac"],
  "stitch:klasyczny": ["klasyczny", "classic"],
  "stitch:jodelka": ["jodelka", "herringbone"],
  "stitch:koszykowy": ["koszykowy", "basket"],
  "stitch:muszla": ["muszla", "shell"],
  "flap:bez-klapy": ["bez-klapy", "none"],
  "flap:szydelkowa": ["szydelkowa", "crochet"],
  "flap:skorzana-czarna": ["skorzana-czarna", "czarna-skora", "leather-black"],
  "flap:skorzana-koniak": ["skorzana-koniak", "koniakowa-skora", "leather-cognac"],
  "flap:zamszowa-bordo": ["zamszowa-bordo", "bordowy-zamsz", "suede-burgundy"],
  "handles:bez-uchwytu": ["bez-uchwytu", "bez-uchwytow", "none"],
  "handles:drewniane-jasne": ["drewniane-jasne", "drewno-jasne", "drewniane", "wood-light"],
  "handles:drewniane-ciemne": ["drewniane-ciemne", "drewno-ciemne", "wood-dark"],
  "handles:szydelkowe": ["szydelkowe", "szydelkowy", "crochet"],
  "hardware:zlote": ["zlote", "gold"],
  "hardware:srebrne": ["srebrne", "silver"],
  "hardware:czarne": ["czarne", "black"],
  "strap:bez-paska": ["bez-paska", "none"],
  "strap:skorzany": ["skorzany", "regulowany", "leather"],
  "strap:tkany": ["tkany", "materialowy", "regulowany", "woven"],
  "strap:lancuszek-premium": ["lancuszek-premium", "lancuszek", "chain"],
  "accent:bez-ozdoby": ["bez-ozdoby", "none"],
  "accent:chwost": ["chwost", "tassel"],
  "accent:apaszka": ["apaszka", "kokarda", "scarf"],
  "accent:zawieszka": ["zawieszka", "charm"],
};

function categoryLabel(value: string) {
  return CATEGORIES.find(([key]) => key === value)?.[1] ?? value;
}

function slug(value: string) {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function acceptedKeys(category: string, preset: PresetVariant) {
  return PREVIEW_ALIASES[`${category}:${preset.value}`] ?? [preset.value];
}

function canonicalVariant(category: string, value: string) {
  const normalized = slug(value);
  const preset = (PRESET_VARIANTS[category] ?? []).find((item) => {
    const candidates = new Set([...acceptedKeys(category, item), slug(item.label)]);
    return candidates.has(normalized);
  });
  return preset?.value ?? normalized;
}

function hasPreviewAsset(assets: Asset[], category: string, preset: PresetVariant) {
  const candidates = new Set(acceptedKeys(category, preset));
  return assets.some((asset) => asset.category === category && candidates.has(asset.variant));
}

function isKnownPreviewAsset(asset: Asset) {
  return (PRESET_VARIANTS[asset.category] ?? []).some((preset) => acceptedKeys(asset.category, preset).includes(asset.variant));
}

export default function CustomizerAssetsManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [category, setCategory] = useState("color");
  const [variant, setVariant] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/products", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.products)) throw new Error(data.error ?? "Nie udało się wczytać produktów.");
        return data.products as Product[];
      })
      .then((items) => {
        setProducts(items);
        setProductId((current) => current || items[0]?.id || "");
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Nie udało się wczytać produktów."));
  }, []);

  useEffect(() => {
    if (!productId) return;
    const controller = new AbortController();
    fetch(`/api/admin/customizer-assets?productId=${encodeURIComponent(productId)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.assets)) throw new Error(data.error ?? "Nie udało się wczytać warstw.");
        return data.assets as Asset[];
      })
      .then((items) => setAssets(items))
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Nie udało się wczytać warstw.");
      });
    return () => controller.abort();
  }, [productId]);

  const selectedProduct = products.find((product) => product.id === productId) ?? null;
  const grouped = useMemo(() => CATEGORIES.map(([key, label]) => ({ key, label, assets: assets.filter((asset) => asset.category === key) })), [assets]);
  const presets = PRESET_VARIANTS[category] ?? [];

  const coverage = useMemo(() => CATEGORIES.map(([key, label]) => {
    const targets = (PRESET_VARIANTS[key] ?? []).filter((preset) => !BASE_PREVIEW_VARIANTS.has(`${key}:${preset.value}`));
    const covered = targets.filter((preset) => hasPreviewAsset(assets, key, preset));
    const missing = targets.filter((preset) => !hasPreviewAsset(assets, key, preset));
    return { key, label, targets, covered, missing };
  }), [assets]);

  const totalTargets = coverage.reduce((sum, item) => sum + item.targets.length, 0);
  const totalCovered = coverage.reduce((sum, item) => sum + item.covered.length, 0);
  const coveragePercent = totalTargets ? Math.round((totalCovered / totalTargets) * 100) : 0;
  const customAssets = assets.filter((asset) => !isKnownPreviewAsset(asset));

  const focusMissing = (nextCategory: string, preset: PresetVariant) => {
    setCategory(nextCategory);
    setVariant(preset.label);
    window.requestAnimationFrame(() => document.querySelector<HTMLElement>(".customizer-admin-upload")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setError("");
    const normalizedVariant = canonicalVariant(category, variant);
    if (!productId || !normalizedVariant || !file) {
      setError("Wybierz produkt, nazwij wariant i dodaj plik PNG lub WEBP.");
      return;
    }
    const formData = new FormData();
    formData.set("productId", productId);
    formData.set("category", category);
    formData.set("variant", normalizedVariant);
    formData.set("image", file);
    setPending(true);
    try {
      const response = await fetch("/api/admin/customizer-assets", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.assets)) throw new Error(data.error ?? "Nie udało się zapisać warstwy.");
      setAssets(data.assets);
      setVariant("");
      setFile(null);
      const input = document.getElementById("customizer-layer-file") as HTMLInputElement | null;
      if (input) input.value = "";
      setMessage("Warstwa została zapisana. Photo-True Creator może użyć jej od razu.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nie udało się zapisać warstwy.");
    } finally {
      setPending(false);
    }
  };

  const remove = async (asset: Asset) => {
    setMessage("");
    setError("");
    setPending(true);
    try {
      const params = new URLSearchParams({ productId: asset.productId, category: asset.category, variant: asset.variant });
      const response = await fetch(`/api/admin/customizer-assets?${params.toString()}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.assets)) throw new Error(data.error ?? "Nie udało się usunąć warstwy.");
      setAssets(data.assets);
      setMessage("Warstwa została usunięta.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nie udało się usunąć warstwy.");
    } finally {
      setPending(false);
    }
  };

  return <section className="admin-customizer-manager">
    <div className="admin-module-heading">
      <div>
        <p className="eyebrow">Photo-True Creator V5</p>
        <h2>Warstwy personalizacji 1:1</h2>
        <p>Dodawaj przezroczyste warstwy PNG/WEBP na prawdziwe zdjęcie konkretnego produktu. Kształt, proporcje, uchwyty i detale pozostają fotograficznie zgodne z bazowym modelem A-Bags.</p>
      </div>
      <span className="admin-live-badge">{assets.length} warstw</span>
    </div>

    <div className="customizer-admin-product">
      <label><span>Produkt bazowy / fason</span><select value={productId} onChange={(event) => { setProductId(event.target.value); setAssets([]); setMessage(""); setError(""); }}>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
      {selectedProduct && <div className="customizer-admin-product-card">{selectedProduct.imageUrl ? <img src={selectedProduct.imageUrl} alt="" /> : <span>◇</span>}<div><strong>{selectedProduct.name}</strong><small>ID: {selectedProduct.id}</small></div></div>}
    </div>

    {selectedProduct && <section className="photo-coverage" aria-labelledby="photo-coverage-heading">
      <div className="photo-coverage-head">
        <div>
          <p className="eyebrow">Kontrola podglądu</p>
          <h3 id="photo-coverage-heading">Pokrycie biblioteki 1:1 · {selectedProduct.name}</h3>
          <p>To jest wyłącznie kontrola kompletności fotografii. Brak warstwy <strong>nie oznacza</strong>, że wariantu nie można wykonać — oznacza tylko, że kreator nie pokaże go fotograficznie 1:1.</p>
        </div>
        <div className="photo-coverage-score" aria-label={`${totalCovered} z ${totalTargets} wariantów ma podgląd 1 do 1`}>
          <strong>{totalCovered}<span>/{totalTargets}</span></strong>
          <small>{coveragePercent}% biblioteki</small>
        </div>
      </div>
      <div className="photo-coverage-progress" aria-hidden="true"><span style={{ width: `${coveragePercent}%` }} /></div>
      <p className="photo-coverage-base-note"><strong>BAZA:</strong> „bez klapy”, „bez uchwytu”, „bez paska” i „bez ozdoby” korzystają z prawdziwego zdjęcia bazowego i nie zwiększają licznika wymaganych nakładek.</p>

      <div className="photo-coverage-grid">
        {coverage.map((item) => <article key={item.key} className={item.missing.length === 0 ? "is-complete" : ""}>
          <header><div><strong>{item.label}</strong><small>{item.covered.length} / {item.targets.length} warstw 1:1</small></div><span>{item.missing.length === 0 ? "✓" : item.missing.length}</span></header>
          {item.missing.length === 0 ? <p className="photo-coverage-complete">Pełne pokrycie podglądu w tej kategorii.</p> : <div className="photo-coverage-missing"><small>Brakuje podglądu:</small><div>{item.missing.map((preset) => <button key={preset.value} type="button" onClick={() => focusMissing(item.key, preset)}>{preset.label}<span>＋</span></button>)}</div></div>}
        </article>)}
      </div>

      {customAssets.length > 0 && <p className="photo-coverage-custom"><strong>{customAssets.length}</strong> {customAssets.length === 1 ? "warstwa ma" : "warstwy mają"} niestandardowy klucz wariantu. Pozostają zapisane, ale nie są liczone jako pokrycie standardowych opcji kreatora.</p>}
    </section>}

    <form className="customizer-admin-upload" onSubmit={submit}>
      <label><span>Kategoria</span><select value={category} onChange={(event) => { setCategory(event.target.value); setVariant(""); }}>{CATEGORIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label><span>Nazwa wariantu</span><input value={variant} list={presets.length ? "customizer-variant-presets" : undefined} onChange={(event) => setVariant(event.target.value)} placeholder="Wybierz lub wpisz wariant 1:1" maxLength={80} />{presets.length > 0 && <datalist id="customizer-variant-presets">{presets.map((preset) => <option key={preset.value} value={preset.label}>{preset.value}</option>)}</datalist>}<small>Zapisze się jako: {canonicalVariant(category, variant) || "—"} · warstwa musi pasować do kadru produktu bazowego.</small></label>
      <label><span>Warstwa PNG / WEBP</span><input id="customizer-layer-file" type="file" accept="image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><small>Ten sam kadr i rozmiar co zdjęcie bazowe, przezroczyste tło. Nie używaj warstwy z innego fasonu.</small></label>
      <button type="submit" disabled={pending}>{pending ? "Zapisywanie…" : "Dodaj / zastąp warstwę 1:1"}</button>
    </form>

    {message && <p className="admin-message is-success">{message}</p>}
    {error && <p className="admin-message is-error">{error}</p>}

    <div className="customizer-admin-groups">
      {grouped.map((group) => <section key={group.key}>
        <div className="customizer-admin-group-heading"><h3>{group.label}</h3><span>{group.assets.length}</span></div>
        {group.assets.length === 0 ? <p className="customizer-admin-empty">Brak przygotowanych warstw 1:1 dla tej kategorii.</p> : <div className="customizer-admin-assets">{group.assets.map((asset) => <article key={`${asset.category}:${asset.variant}`}><div className="customizer-admin-thumb"><img src={asset.imageUrl} alt="" /></div><div><strong>{asset.variant}</strong><small>{categoryLabel(asset.category)}</small></div><button type="button" disabled={pending} onClick={() => remove(asset)}>Usuń</button></article>)}</div>}
      </section>)}
    </div>
  </section>;
}
