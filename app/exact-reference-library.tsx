"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type ProductReference = {
  id: string;
  name: string;
  detail: string;
  stitchType: string;
  imageUrl: string | null;
};

export default function ExactReferenceLibrary() {
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [preview, setPreview] = useState<HTMLElement | null>(null);
  const [products, setProducts] = useState<ProductReference[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [showReference, setShowReference] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/products", { cache: "no-store", signal: controller.signal })
      .then(async (response) => response.ok ? response.json() : Promise.reject(new Error("references unavailable")))
      .then((data: { products?: ProductReference[] }) => setProducts(Array.isArray(data.products) ? data.products.filter((item) => Boolean(item.imageUrl)) : []))
      .catch(() => { if (!controller.signal.aborted) setProducts([]); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const attach = () => {
      const dialog = document.querySelector<HTMLElement>(".abags-vc-dialog");
      if (!dialog) {
        setMount(null);
        setPreview(null);
        return;
      }
      let target = dialog.querySelector<HTMLElement>("[data-abags-exact-reference-library]");
      if (!target) {
        target = document.createElement("div");
        target.dataset.abagsExactReferenceLibrary = "true";
        target.className = "abags-exact-reference-mount";
        const layout = dialog.querySelector(".abags-vc-layout");
        dialog.insertBefore(target, layout ?? null);
      }
      setMount((current) => current === target ? current : target);
      const nextPreview = dialog.querySelector<HTMLElement>(".abags-vc-preview");
      setPreview((current) => current === nextPreview ? current : nextPreview);
    };

    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!mount) return;
    const dialog = mount.closest<HTMLElement>(".abags-vc-dialog");
    if (!dialog) return;
    const clearReferenceOnConfiguratorChange = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target || target.closest("[data-abags-exact-reference-library]")) return;
      if (target.closest(".abags-vc-controls button")) {
        setSelectedId("");
        setShowReference(true);
      }
    };
    dialog.addEventListener("click", clearReferenceOnConfiguratorChange, true);
    return () => dialog.removeEventListener("click", clearReferenceOnConfiguratorChange, true);
  }, [mount]);

  const selected = useMemo(() => products.find((item) => item.id === selectedId) ?? null, [products, selectedId]);

  useEffect(() => {
    if (!preview) return;
    preview.classList.toggle("has-exact-reference", Boolean(selected?.imageUrl && showReference));
    return () => preview.classList.remove("has-exact-reference");
  }, [preview, selected, showReference]);

  if (!mount || products.length === 0) return null;

  return <>
    {createPortal(<section className="abags-exact-reference-library" aria-labelledby="abags-exact-reference-title">
      <div className="abags-exact-reference-heading">
        <div>
          <p className="eyebrow">Biblioteka atelier · 1:1</p>
          <h3 id="abags-exact-reference-title">Rzeczywiste wzorce produktów</h3>
          <p>Każdy wzorzec korzysta bezpośrednio z rzeczywistego zdjęcia produktu zapisanego w bibliotece sklepu. W tym trybie konfigurator nie generuje ani nie przerysowuje splotu, proporcji czy detali.</p>
        </div>
        <span>{products.length} wzorców online</span>
      </div>
      <div className="abags-exact-reference-grid">
        {products.map((item) => <button key={item.id} type="button" className={selectedId === item.id ? "is-active" : ""} onClick={() => { setSelectedId(item.id); setShowReference(true); }} aria-pressed={selectedId === item.id}>
          <span className="abags-exact-reference-thumb">{item.imageUrl && <img src={item.imageUrl} alt="" loading="lazy" />}</span>
          <span className="abags-exact-reference-copy"><strong>{item.name}</strong><small>{item.detail || item.stitchType || "Rzeczywisty produkt A-Bags"}</small></span>
          <span className="abags-exact-reference-status">oryginał 1:1</span>
        </button>)}
      </div>
      {selected && <div className="abags-exact-reference-details">
        <div><strong>Aktywny wzorzec: {selected.name}</strong><span>{selected.detail || selected.stitchType || "produkt referencyjny"}</span></div>
        <div className="abags-exact-reference-parts" aria-label="Warstwy obsługiwane przez konfigurator"><span>korpus</span><span>splot</span><span>klapa</span><span>uchwyty</span><span>pasek</span><span>okucia</span><span>chwost / apaszka / zawieszka</span></div>
        <button type="button" onClick={() => { setSelectedId(""); setShowReference(true); }}>Wróć do konfiguracji warstwowej</button>
      </div>}
    </section>, mount)}
    {selected?.imageUrl && preview && createPortal(<>
      {showReference && <img className="abags-vc-exact-reference" src={selected.imageUrl} alt={`Wzorzec 1:1: ${selected.name}`} />}
      {showReference && <div className="abags-vc-exact-reference-badge">Wzorzec 1:1 · zdjęcie produktu</div>}
      <button type="button" className="abags-vc-exact-reference-toggle" onClick={() => setShowReference((current) => !current)}>{showReference ? "Pokaż model bazowy" : "Pokaż wzorzec 1:1"}</button>
    </>, preview)}
  </>;
}
