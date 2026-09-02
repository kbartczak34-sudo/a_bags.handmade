"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

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

const CATEGORIES = [
  ["color", "Kolor"],
  ["stitch", "Splot / ścieg"],
  ["handles", "Uchwyty"],
  ["hardware", "Okucia"],
  ["strap", "Pasek"],
  ["accent", "Detal / ozdoba"],
] as const;

const PRESET_VARIANTS: Record<string, Array<{ label: string; value: string }>> = {
  color: [
    { label: "Naturalny beż", value: "natural-bez" },
    { label: "Pudrowy róż", value: "pudrowy-roz" },
    { label: "Głęboki granat", value: "gleboki-granat" },
    { label: "Czekoladowy brąz", value: "czekoladowy-braz" },
    { label: "Musztardowy", value: "musztardowy" },
    { label: "Czarny", value: "czarny" },
  ],
  handles: [
    { label: "Klasyczne", value: "klasyczne" },
    { label: "Drewniane", value: "drewniane" },
    { label: "Łańcuszek", value: "lancuszek" },
  ],
  hardware: [
    { label: "Złote", value: "zlote" },
    { label: "Srebrne", value: "srebrne" },
    { label: "Czarne", value: "czarne" },
  ],
  strap: [
    { label: "Bez dodatkowego paska", value: "bez-paska" },
    { label: "Regulowany", value: "regulowany" },
    { label: "Łańcuszek premium", value: "lancuszek-premium" },
  ],
  accent: [
    { label: "Bez ozdoby", value: "bez-ozdoby" },
    { label: "Chwost", value: "chwost" },
    { label: "Apaszka / kokarda", value: "apaszka" },
    { label: "Zawieszka", value: "zawieszka" },
  ],
  stitch: [],
};

function categoryLabel(value: string) {
  return CATEGORIES.find(([key]) => key === value)?.[1] ?? value;
}

function slug(value: string) {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
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

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setError("");
    const normalizedVariant = slug(variant);
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
      setMessage("Warstwa została zapisana. Konfigurator może użyć jej od razu.");
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
        <p className="eyebrow">Visual Customizer 2.0</p>
        <h2>Warstwy personalizacji</h2>
        <p>Dodawaj przezroczyste warstwy PNG/WEBP, które są nakładane na prawdziwe zdjęcie produktu. Dzięki temu konstrukcja torebki pozostaje 1:1.</p>
      </div>
      <span className="admin-live-badge">{assets.length} warstw</span>
    </div>

    <div className="customizer-admin-product">
      <label><span>Produkt</span><select value={productId} onChange={(event) => { setProductId(event.target.value); setAssets([]); setMessage(""); setError(""); }}>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
      {selectedProduct && <div className="customizer-admin-product-card">{selectedProduct.imageUrl ? <img src={selectedProduct.imageUrl} alt="" /> : <span>◇</span>}<div><strong>{selectedProduct.name}</strong><small>ID: {selectedProduct.id}</small></div></div>}
    </div>

    <form className="customizer-admin-upload" onSubmit={submit}>
      <label><span>Kategoria</span><select value={category} onChange={(event) => { setCategory(event.target.value); setVariant(""); }}>{CATEGORIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label><span>Nazwa wariantu</span><input value={variant} list={presets.length ? "customizer-variant-presets" : undefined} onChange={(event) => setVariant(event.target.value)} placeholder={category === "stitch" ? "np. Ścieg muszelkowy" : "Wybierz lub wpisz wariant"} maxLength={80} />{presets.length > 0 && <datalist id="customizer-variant-presets">{presets.map((preset) => <option key={preset.value} value={preset.label}>{preset.value}</option>)}</datalist>}<small>Zapisze się jako: {slug(variant) || "—"}{presets.length > 0 ? " · najlepiej użyj jednej z podpowiedzi" : ""}</small></label>
      <label><span>Warstwa PNG / WEBP</span><input id="customizer-layer-file" type="file" accept="image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><small>Najlepiej taki sam kadr i rozmiar jak produkt bazowy, z przezroczystym tłem.</small></label>
      <button type="submit" disabled={pending}>{pending ? "Zapisywanie…" : "Dodaj / zastąp warstwę"}</button>
    </form>

    {message && <p className="admin-message is-success">{message}</p>}
    {error && <p className="admin-message is-error">{error}</p>}

    <div className="customizer-admin-groups">
      {grouped.map((group) => <section key={group.key}>
        <div className="customizer-admin-group-heading"><h3>{group.label}</h3><span>{group.assets.length}</span></div>
        {group.assets.length === 0 ? <p className="customizer-admin-empty">Brak przygotowanych warstw.</p> : <div className="customizer-admin-assets">{group.assets.map((asset) => <article key={`${asset.category}:${asset.variant}`}><div className="customizer-admin-thumb"><img src={asset.imageUrl} alt="" /></div><div><strong>{asset.variant}</strong><small>{categoryLabel(asset.category)}</small></div><button type="button" disabled={pending} onClick={() => remove(asset)}>Usuń</button></article>)}</div>}
      </section>)}
    </div>
  </section>;
}
