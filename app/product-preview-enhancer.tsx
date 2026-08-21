"use client";

import { useEffect, useRef, useState } from "react";

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
  const price = card.querySelector<HTMLElement>(".product-info strong")?.textContent?.trim() ?? "";
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

function addPreviewTriggers(open: (product: PreviewProduct) => void) {
  document.querySelectorAll<HTMLElement>(".product-card").forEach((card) => {
    if (card.dataset.previewReady === "true") return;
    card.dataset.previewReady = "true";

    const openCard = () => {
      const product = readProduct(card);
      if (product) open(product);
    };

    const visual = card.querySelector<HTMLElement>(".product-visual");
    if (visual) {
      visual.style.cursor = "zoom-in";
      visual.tabIndex = 0;
      visual.setAttribute("role", "button");
      visual.setAttribute("aria-label", "Pokaż szczegóły produktu");
      visual.addEventListener("click", openCard);
      visual.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openCard();
        }
      });
    }

    const addButton = card.querySelector<HTMLElement>(".add-button");
    if (addButton && !card.querySelector(".product-preview-trigger")) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "product-preview-trigger";
      button.textContent = "Zobacz produkt";
      button.addEventListener("click", openCard);
      addButton.parentElement?.insertBefore(button, addButton);
    }
  });
}

export default function ProductPreviewEnhancer() {
  const [product, setProduct] = useState<PreviewProduct | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const open = (next: PreviewProduct) => setProduct(next);
    addPreviewTriggers(open);
    const observer = new MutationObserver(() => addPreviewTriggers(open));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!product) return;
    document.body.classList.add("modal-open");
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProduct(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [product]);

  const addToCart = () => {
    if (!product) return;
    product.sourceCard.querySelector<HTMLButtonElement>(".add-button")?.click();
    setProduct(null);
  };

  const openCart = () => {
    setProduct(null);
    window.setTimeout(() => {
      document.querySelector<HTMLButtonElement>(".cart-button")?.click();
    }, 0);
  };

  return (
    <>
      <style>{`
        .product-preview-trigger{width:100%;margin:.15rem 0 .55rem;padding:.72rem 1rem;border:1px solid color-mix(in srgb,var(--ink) 18%,transparent);background:transparent;color:var(--ink);font:600 .82rem/1 var(--font-sans);letter-spacing:.02em;cursor:pointer;transition:.2s ease;border-radius:999px}.product-preview-trigger:hover,.product-preview-trigger:focus-visible{background:var(--cream);border-color:var(--rose-deep);outline:none}.abags-preview-layer{position:fixed;inset:0;z-index:10050;display:grid;place-items:center;padding:1rem}.abags-preview-backdrop{position:absolute;inset:0;border:0;background:rgba(44,31,33,.58);backdrop-filter:blur(8px);cursor:default}.abags-preview-dialog{position:relative;width:min(980px,100%);max-height:min(88vh,820px);overflow:auto;background:var(--paper,#fbf6f2);border:1px solid rgba(90,66,69,.12);border-radius:28px;box-shadow:0 30px 90px rgba(30,18,20,.28);display:grid;grid-template-columns:minmax(0,1.15fr) minmax(320px,.85fr)}.abags-preview-media{min-height:560px;background:var(--cream,#fffaf8);display:grid;place-items:center;overflow:hidden;border-radius:27px 0 0 27px}.abags-preview-media img{width:100%;height:100%;max-height:720px;object-fit:contain;padding:1.5rem}.abags-preview-placeholder{display:grid;place-items:center;gap:.5rem;color:var(--ink);opacity:.65}.abags-preview-placeholder span{font-family:var(--font-display);font-size:3rem}.abags-preview-copy{padding:clamp(1.5rem,4vw,3.5rem);display:flex;flex-direction:column;justify-content:center}.abags-preview-topline{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:2.4rem}.abags-preview-number{font:600 .72rem/1 var(--font-sans);letter-spacing:.18em;text-transform:uppercase;color:var(--rose-deep)}.abags-preview-close{width:42px;height:42px;border:1px solid rgba(90,66,69,.18);border-radius:50%;background:transparent;color:var(--ink);font-size:1.55rem;line-height:1;cursor:pointer}.abags-preview-copy h2{font-family:var(--font-display);font-size:clamp(2.3rem,5vw,4.2rem);font-weight:500;line-height:.95;margin:0 0 1rem;color:var(--ink)}.abags-preview-detail{font:400 1rem/1.75 var(--font-sans);color:color-mix(in srgb,var(--ink) 78%,transparent);margin:0 0 1.7rem;white-space:pre-wrap}.abags-preview-price{font-family:var(--font-display);font-size:2rem;color:var(--ink);margin:0 0 2rem}.abags-preview-actions{display:grid;gap:.75rem}.abags-preview-add,.abags-preview-cart{min-height:52px;border-radius:999px;padding:.9rem 1.25rem;font:700 .86rem/1 var(--font-sans);cursor:pointer}.abags-preview-add{border:1px solid var(--rose-deep);background:var(--rose-deep);color:white}.abags-preview-cart{border:1px solid rgba(90,66,69,.22);background:transparent;color:var(--ink)}.abags-preview-note{font:400 .72rem/1.55 var(--font-sans);opacity:.62;margin:1rem 0 0}@media(max-width:760px){.abags-preview-layer{padding:.65rem}.abags-preview-dialog{grid-template-columns:1fr;max-height:94vh;border-radius:22px}.abags-preview-media{min-height:0;height:min(54vh,440px);border-radius:21px 21px 0 0}.abags-preview-media img{padding:.75rem}.abags-preview-copy{padding:1.35rem 1.2rem 1.5rem}.abags-preview-topline{margin-bottom:1rem}.abags-preview-copy h2{font-size:2.55rem}.abags-preview-detail{margin-bottom:1rem}.abags-preview-price{margin-bottom:1.25rem}}
      `}</style>
      {product && (
        <div className="abags-preview-layer">
          <button className="abags-preview-backdrop" type="button" aria-label="Zamknij podgląd produktu" onClick={() => setProduct(null)} />
          <section className="abags-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="abags-preview-title">
            <div className="abags-preview-media">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt={product.imageAlt} />
              ) : (
                <div className="abags-preview-placeholder"><span>◇</span><strong>Zdjęcie produktu</strong></div>
              )}
            </div>
            <div className="abags-preview-copy">
              <div className="abags-preview-topline">
                <span className="abags-preview-number">Model {product.number || "a_bags"}</span>
                <button ref={closeButtonRef} className="abags-preview-close" type="button" onClick={() => setProduct(null)} aria-label="Zamknij podgląd">×</button>
              </div>
              <h2 id="abags-preview-title">{product.name}</h2>
              <p className="abags-preview-detail">{product.detail || "Ręcznie wykonana torebka a_bags.handmade."}</p>
              <strong className="abags-preview-price">{product.price}</strong>
              <div className="abags-preview-actions">
                <button className="abags-preview-add" type="button" onClick={addToCart}>Dodaj do koszyka →</button>
                <button className="abags-preview-cart" type="button" onClick={openCart}>Przejdź do koszyka</button>
              </div>
              <p className="abags-preview-note">Ręcznie wykonany produkt · bezpieczna płatność Stripe · wysyłka lub odbiór osobisty</p>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
