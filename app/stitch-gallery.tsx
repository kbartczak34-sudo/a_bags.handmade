"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type StitchProduct = {
  id: string;
  name: string;
  detail: string;
  stitchType: string;
  imageUrl: string | null;
};

type ProductsPayload = {
  products?: StitchProduct[];
};

export default function StitchGallery() {
  const [products, setProducts] = useState<StitchProduct[]>([]);
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [activeStitch, setActiveStitch] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/products", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("products unavailable");
        return (await response.json()) as ProductsPayload;
      })
      .then((data) => setProducts(Array.isArray(data.products) ? data.products : []))
      .catch(() => {
        if (!controller.signal.aborted) setProducts([]);
      });

    return () => controller.abort();
  }, []);

  const groups = useMemo(() => {
    const grouped = new Map<string, StitchProduct[]>();
    for (const product of products) {
      const stitch = product.stitchType?.trim();
      if (!stitch) continue;
      const existing = grouped.get(stitch) ?? [];
      existing.push(product);
      grouped.set(stitch, existing);
    }
    return grouped;
  }, [products]);

  const stitchNames = useMemo(() => Array.from(groups.keys()), [groups]);

  useEffect(() => {
    if (stitchNames.length === 0) {
      setActiveStitch("");
      return;
    }
    if (!activeStitch || !groups.has(activeStitch)) setActiveStitch(stitchNames[0]);
  }, [activeStitch, groups, stitchNames]);

  useEffect(() => {
    if (stitchNames.length === 0) {
      setMount(null);
      return;
    }

    const host = document.createElement("div");
    host.className = "stitch-gallery-mount";
    const anchor =
      document.getElementById("opinie") ??
      document.getElementById("instagram") ??
      document.getElementById("kontakt");

    if (!anchor?.parentElement) return;
    anchor.parentElement.insertBefore(host, anchor);
    setMount(host);

    return () => {
      setMount(null);
      host.remove();
    };
  }, [stitchNames.length]);

  if (!mount || stitchNames.length === 0 || !activeStitch) return null;

  const visibleProducts = groups.get(activeStitch) ?? [];

  const openProduct = (product: StitchProduct) => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>(".product-card"));
    const card = cards.find(
      (candidate) =>
        candidate.querySelector<HTMLElement>(".product-info h3")?.textContent?.trim() ===
        product.name,
    );

    if (!card) {
      document.getElementById("kolekcja")?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    card.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      const trigger = card.querySelector<HTMLButtonElement>(".product-preview-trigger");
      if (trigger) trigger.click();
      else card.querySelector<HTMLElement>(".product-visual")?.focus();
    }, 350);
  };

  return createPortal(
    <section className="stitch-gallery" id="sploty" aria-labelledby="stitch-gallery-title">
      <div className="stitch-gallery-heading">
        <div>
          <p className="eyebrow">Sploty i detale</p>
          <h2 id="stitch-gallery-title">Poznaj techniki, które tworzą charakter torebki</h2>
        </div>
        <p>
          Każdy model powstaje ręcznie. Wybierz technikę, aby porównać torebki
          wykonane tym samym splotem lub ściegiem.
        </p>
      </div>

      <div className="stitch-tabs" role="group" aria-label="Wybierz splot lub ścieg">
        {stitchNames.map((stitch) => (
          <button
            type="button"
            key={stitch}
            className={activeStitch === stitch ? "is-active" : ""}
            aria-pressed={activeStitch === stitch}
            onClick={() => setActiveStitch(stitch)}
          >
            {stitch}
            <span aria-hidden="true">{groups.get(stitch)?.length ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="stitch-product-grid" aria-live="polite">
        {visibleProducts.map((product) => (
          <article className="stitch-product-card" key={product.id}>
            <button type="button" onClick={() => openProduct(product)}>
              <div className="stitch-product-media">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} loading="lazy" />
                ) : (
                  <div className="stitch-product-placeholder" aria-hidden="true">◇</div>
                )}
              </div>
              <div className="stitch-product-copy">
                <span>{activeStitch}</span>
                <h3>{product.name}</h3>
                {product.detail && <p>{product.detail}</p>}
                <strong>Zobacz model <span aria-hidden="true">→</span></strong>
              </div>
            </button>
          </article>
        ))}
      </div>
    </section>,
    mount,
  );
}
