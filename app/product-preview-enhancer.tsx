"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type PreviewProduct = {
  name: string;
  detail: string;
  price: string;
  imageUrl: string | null;
  imageAlt: string;
  number: string;
  sourceCard: HTMLElement;
};

function readProduct(card: HTMLElement): PreviewProduct | null {
  const name = card.querySelector<HTMLElement>(".product-info h3")?.textContent?.trim() ?? "";
  const detail = card.querySelector<HTMLElement>(".product-info p")?.textContent?.trim() ?? "";
  const price = card.querySelector<HTMLElement>(".product-info > strong")?.textContent?.trim()
    ?? card.querySelector<HTMLElement>(".product-info strong")?.textContent?.trim()
    ?? "";
  const image = card.querySelector<HTMLImageElement>(".product-photo");
  const number = card.querySelector<HTMLElement>(".product-number")?.textContent?.trim() ?? "";
  if (!name || !price) return null;
  return {
    name,
    detail,
    price,
    imageUrl: image?.src ?? null,
    imageAlt: image?.alt || name,
    number,
    sourceCard: card,
  };
}

function ensurePreviewTriggers() {
  document.querySelectorAll<HTMLElement>(".product-card").forEach((card) => {
    const visual = card.querySelector<HTMLElement>(".product-visual");
    if (visual && visual.dataset.previewTrigger !== "true") {
      visual.dataset.previewTrigger = "true";
      visual.style.cursor = "zoom-in";
      visual.tabIndex = 0;
      visual.setAttribute("role", "button");
      visual.setAttribute("aria-label", "Zobacz szczegóły produktu");
    }

    const addButton = card.querySelector<HTMLElement>(".add-button");
    if (addButton && !card.querySelector(".product-preview-trigger")) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "product-preview-trigger";
      button.dataset.previewTrigger = "true";
      button.textContent = "Zobacz produkt";
      addButton.parentElement?.insertBefore(button, addButton);
    }
  });
}

export default function ProductPreviewEnhancer() {
  const [product, setProduct] = useState<PreviewProduct | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const closePreview = useCallback(() => {
    const source = product?.sourceCard;
    setProduct(null);
    window.setTimeout(() => {
      source?.scrollIntoView({ behavior: "smooth", block: "center" });
      previousFocusRef.current?.focus();
    }, 0);
  }, [product]);

  useEffect(() => {
    ensurePreviewTriggers();
    const observer = new MutationObserver(ensurePreviewTriggers);
    observer.observe(document.body, { childList: true, subtree: true });

    const openFromTarget = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      const trigger = target.closest<HTMLElement>("[data-preview-trigger='true'], .product-preview-trigger");
      if (!trigger) return false;
      const card = trigger.closest<HTMLElement>(".product-card");
      if (!card) return false;
      const next = readProduct(card);
      if (!next) return false;
      previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setProduct(next);
      return true;
    };

    const onClick = (event: MouseEvent) => {
      if (openFromTarget(event.target)) event.preventDefault();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (openFromTarget(event.target)) event.preventDefault();
    };

    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      observer.disconnect();
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!product) return;
    document.body.classList.add("modal-open");
    requestAnimationFrame(() => closeButtonRef.current?.focus());
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePreview();
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", onEscape);
    };
  }, [product, closePreview]);

  const addToCart = () => {
    if (!product) return;
    product.sourceCard.querySelector<HTMLButtonElement>(".add-button")?.click();
    setProduct(null);
  };

  const openCart = () => {
    setProduct(null);
    window.setTimeout(() => document.querySelector<HTMLButtonElement>(".cart-button")?.click(), 0);
  };

  return (
    <>
      <style>{`
        .product-preview-trigger{width:100%;margin:.15rem 0 .55rem;padding:.72rem 1rem;border:1px solid color-mix(in srgb,var(--ink) 18%,transparent);background:transparent;color:var(--ink);font:600 .82rem/1 var(--font-sans);letter-spacing:.02em;cursor:pointer;transition:.2s ease;border-radius:999px}
        .product-preview-trigger:hover,.product-preview-trigger:focus-visible{background:var(--cream);border-color:var(--rose-deep);outline:none}
        .abags-preview-layer{position:fixed;inset:0;z-index:10050;display:grid;place-items:center;padding:1rem}
        .abags-preview-backdrop{position:absolute;inset:0;border:0;background:rgba(44,31,33,.58);backdrop-filter:blur(8px);cursor:default}
        .abags-preview-dialog{position:relative;width:min(980px,100%);max-height:min(88vh,820px);overflow:auto;background:var(--paper,#fbf6f2);border:1px solid rgba(90,66,69,.12);border-radius:28px;box-shadow:0 30px 90px rgba(30,18,20,.28);display:grid;grid-template-columns:minmax(0,1.15fr) minmax(320px,.85fr)}
        .abags-preview-media{min-height:560px;background:var(--cream,#fffaf8);display:grid;place-items:center;overflow:hidden;border-radius:27px 0 0 27px}
        .abags-preview-media img{width:100%;height:100%;max-height:720px;object-fit:contain;padding:1.5rem}
        .abags-preview-placeholder{display:grid;place-items:center;gap:.5rem;color:var(--ink);opacity:.65}
        .abags-preview-placeholder span{font-family:var(--font-display);font-size:3rem}
        .abags-preview-copy{padding:clamp(1.5rem,4vw,3.5rem);display:flex;flex-direction:column;justify-content:center}
        .abags-preview-number{font:600 .72rem/1 var(--font-sans);letter-spacing:.18em;text-transform:uppercase;color:var(--rose-deep);margin-bottom:1.35rem}
        .abags-preview-close-floating{position:absolute;z-index:8;top:14px;right:14px;width:48px;height:48px;border-radius:999px;border:1px solid rgba(30,22,25,.16);background:rgba(255,255,255,.96);box-shadow:0 8px 26px rgba(35,20,25,.14);display:grid;place-items:center;color:#2b2023;font-size:1.8rem;line-height:1;cursor:pointer;transition:transform .18s ease,background .18s ease}
        .abags-preview-close-floating:hover{transform:scale(1.06);background:#fff}
        .abags-preview-close-floating:focus-visible{outline:3px solid rgba(82,48,60,.25);outline-offset:3px}
        .abags-preview-copy h2{font-family:var(--font-display);font-size:clamp(2.3rem,5vw,4.2rem);font-weight:500;line-height:.95;margin:0 0 1rem;color:var(--ink)}
        .abags-preview-detail{font:400 1rem/1.75 var(--font-sans);color:color-mix(in srgb,var(--ink) 78%,transparent);margin:0 0 1.25rem;white-space:pre-wrap}
        .abags-preview-availability{margin:0 0 1.25rem;padding:.85rem 1rem;border-radius:16px;background:color-mix(in srgb,var(--cream) 78%,transparent)}
        .abags-preview-availability strong{display:block;font-size:.86rem;margin-bottom:.3rem}.abags-preview-availability span{font-size:.8rem;opacity:.72;line-height:1.5}
        .abags-preview-price{font-family:var(--font-display);font-size:2rem;color:var(--ink);margin:0 0 1.45rem}
        .abags-preview-price small{display:block;font:500 .68rem/1.4 var(--font-sans);opacity:.6;margin-top:.25rem}
        .abags-preview-actions{display:grid;gap:.75rem}
        .abags-preview-add,.abags-preview-cart{min-height:52px;border-radius:999px;padding:.9rem 1.25rem;font:700 .86rem/1 var(--font-sans);cursor:pointer}
        .abags-preview-add{border:1px solid var(--rose-deep);background:var(--rose-deep);color:white}
        .abags-preview-cart{border:1px solid rgba(90,66,69,.22);background:transparent;color:var(--ink)}
        .abags-preview-return{display:inline-flex;align-items:center;gap:.4rem;margin-top:.7rem;border:0;background:transparent;padding:.55rem 0;color:var(--ink);font:600 .78rem/1.2 var(--font-sans);text-decoration:underline;text-underline-offset:4px;cursor:pointer}
        .abags-preview-note{font:400 .72rem/1.55 var(--font-sans);opacity:.62;margin:1rem 0 0}
        @media(max-width:760px){.abags-preview-layer{padding:.55rem}.abags-preview-dialog{grid-template-columns:1fr;max-height:95vh;border-radius:22px}.abags-preview-media{min-height:0;height:min(50vh,420px);border-radius:21px 21px 0 0}.abags-preview-media img{padding:.65rem}.abags-preview-copy{padding:1.25rem 1.15rem 1.45rem}.abags-preview-number{margin-bottom:.8rem}.abags-preview-copy h2{font-size:2.45rem}.abags-preview-detail{margin-bottom:.85rem}.abags-preview-price{margin-bottom:1.1rem}.abags-preview-close-floating{position:fixed;top:max(12px,env(safe-area-inset-top));right:12px;width:50px;height:50px}}
      `}</style>
      {product && (
        <div className="abags-preview-layer">
          <button className="abags-preview-backdrop" type="button" aria-label="Zamknij podgląd i wróć do katalogu" onClick={closePreview} />
          <section className="abags-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="abags-preview-title">
            <button ref={closeButtonRef} className="abags-preview-close-floating" type="button" onClick={closePreview} aria-label="Zamknij produkt i wróć do katalogu" title="Wróć do katalogu">×</button>
            <div className="abags-preview-media">
              {product.imageUrl ? <img src={product.imageUrl} alt={product.imageAlt} /> : <div className="abags-preview-placeholder"><span>◇</span><strong>Zdjęcie produktu</strong></div>}
            </div>
            <div className="abags-preview-copy">
              <span className="abags-preview-number">Model {product.number || "a_bags"}</span>
              <h2 id="abags-preview-title">{product.name}</h2>
              <p className="abags-preview-detail">{product.detail || "Ręcznie wykonana torebka a_bags.handmade."}</p>
              <div className="abags-preview-availability"><strong>Ręcznie wykonany model</strong><span>Dostępność może być ograniczona ze względu na ręczny proces wykonania.</span></div>
              <strong className="abags-preview-price">{product.price}<small>Cena końcowa widoczna w sklepie.</small></strong>
              <div className="abags-preview-actions">
                <button className="abags-preview-add" type="button" onClick={addToCart}>Zamów / dodaj do koszyka →</button>
                <button className="abags-preview-cart" type="button" onClick={openCart}>Przejdź do koszyka</button>
              </div>
              <button className="abags-preview-return" type="button" onClick={closePreview}>← Wróć do katalogu produktów</button>
              <p className="abags-preview-note">Produkt handmade · bezpieczna płatność Stripe · dostawa zgodnie z podsumowaniem zamówienia</p>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
