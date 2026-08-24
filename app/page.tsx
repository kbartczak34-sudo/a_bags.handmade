"use client";

import {
  type CSSProperties,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Script from "next/script";
import {
  products as initialProducts,
  type CatalogProduct,
} from "../lib/catalog";
import {
  defaultSiteContent,
  type SiteContentPayload,
} from "../lib/site-content-shared";

const priceFormatter = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
});

type StorefrontReview = {
  id: string;
  authorName: string;
  content: string;
  createdAt: string;
};

export default function Home() {
  const [siteContent, setSiteContent] = useState(defaultSiteContent);
  const [heroImageUrl, setHeroImageUrl] = useState(
    "/images/limitowana-kolekcja.jpg",
  );
  const [products, setProducts] = useState<CatalogProduct[]>(initialProducts);
  const [catalogError, setCatalogError] = useState("");
  const [reviews, setReviews] = useState<StorefrontReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewPending, setReviewPending] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [paymentNotice, setPaymentNotice] = useState("");
  const cartRestored = useRef(false);
  const checkoutErrorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/site-content", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.content || typeof data.heroImageUrl !== "string") {
          throw new Error(data.error ?? "Nie udało się wczytać treści strony.");
        }
        return data as SiteContentPayload;
      })
      .then((data) => {
        if (!active) return;
        setSiteContent(data.content);
        setHeroImageUrl(data.heroImageUrl);
      })
      .catch(() => {
        // Domyślne treści pozostają widoczne, gdy ustawienia są chwilowo niedostępne.
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/products", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.products)) {
          throw new Error(data.error ?? "Nie udało się wczytać produktów.");
        }
        return data.products as CatalogProduct[];
      })
      .then((items) => {
        if (!active) return;
        setProducts(items);
        setCatalogError("");
      })
      .catch(() => {
        if (active) {
          setCatalogError("Nie udało się odświeżyć produktów. Spróbuj ponownie za chwilę.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/reviews", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.reviews)) {
          throw new Error(data.error ?? "Nie udało się wczytać opinii.");
        }
        return data.reviews as StorefrontReview[];
      })
      .then((items) => {
        if (active) setReviews(items);
      })
      .catch(() => {
        if (active) setReviewError("Nie udało się wczytać opinii.");
      })
      .finally(() => {
        if (active) setReviewsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let restoredCart: Record<string, number> = {};

    try {
      const savedCart = window.localStorage.getItem("abags-cart");
      if (savedCart) restoredCart = JSON.parse(savedCart);
    } catch {
      window.localStorage.removeItem("abags-cart");
    }

    const url = new URL(window.location.href);
    const paymentCancelled = url.searchParams.get("platnosc") === "anulowana";
    if (paymentCancelled) {
      url.searchParams.delete("platnosc");
      window.history.replaceState({}, "", `${url.pathname}${url.hash}`);
    }

    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      cartRestored.current = true;
      setCart(restoredCart);
      if (paymentCancelled) {
        setPaymentNotice("Płatność została anulowana. Twój koszyk nadal na Ciebie czeka.");
        setCartOpen(true);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!cartRestored.current) return;
    window.localStorage.setItem("abags-cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    const modalOpen = cartOpen || checkoutOpen;
    document.body.classList.toggle("modal-open", modalOpen);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setCartOpen(false);
        setCheckoutOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [cartOpen, checkoutOpen]);

  useEffect(() => {
    if (!checkoutError) return;
    checkoutErrorRef.current?.focus();
  }, [checkoutError]);

  useEffect(() => {
    const instagramWindow = window as typeof window & {
      instgrm?: { Embeds?: { process?: () => void } };
    };
    instagramWindow.instgrm?.Embeds?.process?.();
  }, [siteContent.instagram.profileUrl, siteContent.instagram.visible]);

  const cartItems = useMemo(
    () =>
      products
        .filter((product) => cart[product.id])
        .map((product) => ({ ...product, quantity: cart[product.id] })),
    [cart, products],
  );

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const delivery = cartCount === 0 ? 0 : 14.99;
  const total = subtotal + delivery;
  const themeStyle = {
    "--ink": siteContent.theme.ink,
    "--paper": siteContent.theme.paper,
    "--cream": siteContent.theme.cream,
    "--peach": siteContent.theme.accent,
    "--plum": siteContent.theme.accentDark,
    "--rose": siteContent.theme.accent,
    "--rose-deep": siteContent.theme.accentDark,
    "--rose-pale": siteContent.theme.accentLight,
  } as CSSProperties;
  const contactHref = `mailto:${siteContent.contact.email}?subject=${encodeURIComponent(
    "Zapytanie o torebkę a_bags.handmade",
  )}`;

  const closeMenu = () => setMenuOpen(false);

  const addToCart = (productId: string) => {
    setCart((current) => ({
      ...current,
      [productId]: (current[productId] ?? 0) + 1,
    }));
    setCartOpen(true);
  };

  const changeQuantity = (productId: string, delta: number) => {
    setCart((current) => {
      const nextQuantity = (current[productId] ?? 0) + delta;
      const nextCart = { ...current };
      if (nextQuantity <= 0) delete nextCart[productId];
      else nextCart[productId] = nextQuantity;
      return nextCart;
    });
  };

  const openCheckout = () => {
    setCartOpen(false);
    setCheckoutError("");
    setCheckoutOpen(true);
  };

  const handleCheckout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCheckoutPending(true);
    setCheckoutError("");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          items: cartItems.map((item) => ({
            id: item.id,
            quantity: item.quantity,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok || typeof data.url !== "string") {
        throw new Error(data.error ?? "Nie udało się rozpocząć płatności.");
      }

      window.location.assign(data.url);
    } catch (error) {
      setCheckoutError(
        error instanceof Error
          ? error.message
          : "Nie udało się rozpocząć płatności.",
      );
      setCheckoutPending(false);
    }
  };

  const handleReviewSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setReviewPending(true);
    setReviewMessage("");
    setReviewError("");

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: String(formData.get("authorName") ?? ""),
          content: String(formData.get("content") ?? ""),
          website: String(formData.get("website") ?? ""),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Nie udało się wysłać opinii.");
      }
      form.reset();
      setReviewMessage(
        data.message ?? "Dziękujemy! Opinia pojawi się po akceptacji.",
      );
    } catch (error) {
      setReviewError(
        error instanceof Error
          ? error.message
          : "Nie udało się wysłać opinii. Spróbuj ponownie.",
      );
    } finally {
      setReviewPending(false);
    }
  };

  return (
    <main style={themeStyle}>
      {siteContent.announcement.visible && (
        <div className="announcement">
          <p>{siteContent.announcement.primary}</p>
          <span aria-hidden="true">·</span>
          <p>{siteContent.announcement.secondary}</p>
        </div>
      )}

      {paymentNotice && (
        <div className="payment-notice" role="status">
          <span>{paymentNotice}</span>
          <button
            type="button"
            onClick={() => setPaymentNotice("")}
            aria-label="Zamknij komunikat"
          >
            ×
          </button>
        </div>
      )}

      <header className="site-header">
        <a
          className="wordmark"
          href="#top"
          aria-label={`${siteContent.brand.name}.${siteContent.brand.descriptor} — strona główna`}
          onClick={closeMenu}
        >
          <span>{siteContent.brand.name}</span>
          <small>{siteContent.brand.descriptor}</small>
        </a>

        <nav className="desktop-navigation" aria-label="Główna nawigacja">
          <a href="#kolekcja">{siteContent.navigation.collection}</a>
          {siteContent.story.visible && <a href="#historia">{siteContent.navigation.story}</a>}
          {siteContent.reviews.visible && <a href="#opinie">{siteContent.navigation.reviews}</a>}
          <a href="#kontakt">{siteContent.navigation.contact}</a>
        </nav>

        <div className="header-actions">
          <button
            className={`menu-button${menuOpen ? " is-open" : ""}`}
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            aria-label={menuOpen ? "Zamknij menu" : "Otwórz menu"}
            onClick={() => setMenuOpen((current) => !current)}
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
          <button
            className="cart-button"
            type="button"
            aria-label={`Otwórz koszyk. Liczba produktów: ${cartCount}`}
            onClick={() => {
              closeMenu();
              setCartOpen(true);
            }}
          >
            {siteContent.navigation.cart} <span>{cartCount}</span>
          </button>
        </div>

        {menuOpen && (
          <nav
            className="mobile-navigation"
            id="mobile-navigation"
            aria-label="Nawigacja mobilna"
          >
            <a href="#kolekcja" onClick={closeMenu}>
              {siteContent.navigation.collection}
            </a>
            {siteContent.story.visible && (
              <a href="#historia" onClick={closeMenu}>
                {siteContent.navigation.story}
              </a>
            )}
            {siteContent.reviews.visible && (
              <a href="#opinie" onClick={closeMenu}>
                {siteContent.navigation.reviews}
              </a>
            )}
            <a href="#kontakt" onClick={closeMenu}>
              {siteContent.navigation.contact}
            </a>
          </nav>
        )}
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="hero-badge">{siteContent.hero.badge}</p>
          <h1>
            {siteContent.hero.title} <em>{siteContent.hero.accent}</em>
          </h1>
          <p className="hero-lead">
            {siteContent.hero.lead}
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="#kolekcja">
              {siteContent.hero.primaryCta} <span aria-hidden="true">→</span>
            </a>
            {siteContent.story.visible && (
              <a className="text-link" href="#historia">
                {siteContent.hero.secondaryCta}
              </a>
            )}
          </div>
          <div className="hero-notes" aria-label="Najważniejsze informacje">
            <span>{siteContent.hero.noteOne}</span>
            <span>{siteContent.hero.noteTwo}</span>
            <span>{siteContent.hero.noteThree}</span>
          </div>
        </div>

        <div className="hero-art">
          <img
            className="hero-product-photo"
            src={heroImageUrl}
            alt={siteContent.hero.imageAlt}
          />
          <div className="art-label">
            <span>{siteContent.hero.imageLabel}</span>
            <small>{siteContent.hero.imageSublabel}</small>
          </div>
          <p className="art-caption">{siteContent.hero.imageCaption}</p>
        </div>
      </section>

      <section className="collection" id="kolekcja">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{siteContent.collection.eyebrow}</p>
            <h2>{siteContent.collection.title}</h2>
          </div>
          <div className="draft-note">
            <span>{siteContent.collection.noteLabel}</span>
            <p>{siteContent.collection.noteText}</p>
          </div>
        </div>

        {catalogError && (
          <p className="catalog-error" role="status">{catalogError}</p>
        )}

        <div className="product-grid">
          {products.length === 0 && !catalogError && (
            <div className="empty-collection">
              <span aria-hidden="true">◇</span>
              <h3>{siteContent.collection.emptyTitle}</h3>
              <p>{siteContent.collection.emptyText}</p>
            </div>
          )}
          {products.map((product) => (
            <article className="product-card" key={product.id}>
              <div className={`product-visual ${product.tone}`}>
                <span className="product-number">{product.number}</span>
                {product.imageUrl ? (
                  <img
                    className="product-photo"
                    src={product.imageUrl}
                    alt={product.name}
                  />
                ) : (
                  <div className="product-placeholder">
                    <span>Zdjęcie</span>
                    <small>wkrótce</small>
                  </div>
                )}
              </div>
              <div className="product-info">
                <div>
                  <h3>{product.name}</h3>
                  <p>{product.detail}</p>
                </div>
                <strong>{priceFormatter.format(product.price)}</strong>
              </div>
              <button
                className="add-button"
                type="button"
                onClick={() => addToCart(product.id)}
              >
                Dodaj do koszyka <span aria-hidden="true">＋</span>
              </button>
            </article>
          ))}
        </div>
      </section>

      {siteContent.story.visible && (
        <section className="story" id="historia">
          <div className="story-number">01—</div>
          <div>
            <p className="eyebrow">{siteContent.story.eyebrow}</p>
            <h2>{siteContent.story.title}</h2>
          </div>
          <div className="story-copy">
            <p>{siteContent.story.description}</p>
            <a href={contactHref}>{siteContent.story.cta}</a>
          </div>
        </section>
      )}

      {siteContent.benefits.visible && (
        <section className="benefits" id="zalety">
          <div className="centered-heading">
            <p className="eyebrow">{siteContent.benefits.eyebrow}</p>
            <h2>{siteContent.benefits.title}</h2>
          </div>
          <div className="trust-strip" aria-label={`Zalety ${siteContent.brand.name}.${siteContent.brand.descriptor}`}>
            {siteContent.benefits.items.map((item, index) => (
              <article key={`${item.title}-${index}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {siteContent.reviews.visible && (
        <section className="testimonials" id="opinie">
          <div className="centered-heading">
            <p className="eyebrow">{siteContent.reviews.eyebrow}</p>
            <h2>{siteContent.reviews.title}</h2>
          </div>
          <div className="testimonial-grid">
            {reviewsLoading ? (
              <article className="testimonial-empty-card">
                <span className="quote-mark" aria-hidden="true">“</span>
                <p>Wczytywanie opinii klientek…</p>
              </article>
            ) : reviews.length > 0 ? (
              reviews.map((review) => (
                <article key={review.id}>
                  <span className="quote-mark" aria-hidden="true">“</span>
                  <p>{review.content}</p>
                  <div>
                    <strong>{review.authorName}</strong>
                    <small>opinia klientki</small>
                  </div>
                </article>
              ))
            ) : (
              <article className="testimonial-empty-card">
                <span className="quote-mark" aria-hidden="true">“</span>
                <p>{siteContent.reviews.emptyText}</p>
                <div>
                  <strong>{siteContent.reviews.emptyBrand}</strong>
                  <small>{siteContent.reviews.emptyLabel}</small>
                </div>
              </article>
            )}
          </div>

          <div className="review-form-shell">
            <div className="review-form-copy">
              <p className="eyebrow">{siteContent.reviews.formEyebrow}</p>
              <h3>{siteContent.reviews.formTitle}</h3>
              <p>{siteContent.reviews.formDescription}</p>
            </div>
            <form className="review-form" onSubmit={handleReviewSubmit}>
            <label>
              <span>Imię lub inicjały</span>
              <input
                type="text"
                name="authorName"
                autoComplete="name"
                minLength={2}
                maxLength={60}
                placeholder="np. Anna K."
                required
              />
            </label>
            <label>
              <span>Twoja opinia</span>
              <textarea
                name="content"
                minLength={20}
                maxLength={600}
                rows={6}
                placeholder="Napisz, co najbardziej podoba Ci się w torebce…"
                required
              />
              <small>Od 20 do 600 znaków</small>
            </label>
            <label className="review-honeypot" aria-hidden="true">
              <span>Strona internetowa</span>
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
            <label className="review-consent">
              <input type="checkbox" required />
              <span>
                Zgadzam się na publikację podanego imienia lub inicjałów oraz
                treści opinii po jej akceptacji.
              </span>
            </label>
            {(reviewMessage || reviewError) && (
              <p
                className={`review-form-message ${reviewError ? "is-error" : "is-success"}`}
                role="status"
              >
                {reviewError || reviewMessage}
              </p>
            )}
            <button type="submit" disabled={reviewPending}>
              {reviewPending ? "Wysyłanie…" : "Wyślij opinię"}
              <span aria-hidden="true">→</span>
            </button>
            </form>
          </div>
        </section>
      )}

      {siteContent.instagram.visible && (
        <section className="instagram" id="instagram">
          <div className="instagram-heading">
            <div>
              <p className="eyebrow">{siteContent.instagram.eyebrow}</p>
              <h2>{siteContent.instagram.title}</h2>
            </div>
            <a href={siteContent.instagram.profileUrl} target="_blank" rel="noreferrer">
              {siteContent.instagram.handle} <span aria-hidden="true">↗</span>
            </a>
          </div>
          <p className="instagram-feed-note">
            {siteContent.instagram.feedNote}
          </p>
          <div className="instagram-embed-shell" aria-label={`Najnowsze posty z Instagrama ${siteContent.instagram.handle}`}>
            <blockquote
              className="instagram-media instagram-profile-embed"
              data-instgrm-permalink={siteContent.instagram.profileUrl}
              data-instgrm-version="14"
            >
              <a
                href={siteContent.instagram.profileUrl}
                target="_blank"
                rel="noreferrer"
              >
                Zobacz najnowsze posty {siteContent.instagram.handle} na Instagramie ↗
              </a>
            </blockquote>
          </div>
          <Script
            id="instagram-embed-script"
            src="https://www.instagram.com/embed.js"
            strategy="lazyOnload"
            onReady={() => {
              const instagramWindow = window as typeof window & {
                instgrm?: { Embeds?: { process?: () => void } };
              };
              instagramWindow.instgrm?.Embeds?.process?.();
            }}
          />
        </section>
      )}

      <footer id="kontakt">
        <div className="footer-brand">
          <p className="wordmark footer-wordmark">
            <span>{siteContent.brand.name}</span>
            <small>{siteContent.brand.descriptor}</small>
          </p>
          <p>{siteContent.footer.tagline}</p>
        </div>
        <div className="footer-links">
          <div>
            <p>{siteContent.footer.shopLabel}</p>
            <a href="#kolekcja">{siteContent.footer.collectionLink}</a>
            {siteContent.story.visible && <a href="#historia">{siteContent.footer.storyLink}</a>}
            {siteContent.reviews.visible && <a href="#opinie">{siteContent.footer.reviewsLink}</a>}
          </div>
          <div>
            <p>{siteContent.footer.socialLabel}</p>
            <a href={siteContent.instagram.profileUrl} target="_blank" rel="noreferrer">{siteContent.footer.instagramLink}</a>
            <a href={contactHref}>{siteContent.footer.emailLink}</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>{siteContent.footer.copyright}</span>
          <span>{siteContent.footer.statusText}</span>
        </div>
      </footer>

      {cartOpen && (
        <div className="modal-layer">
          <button
            className="modal-backdrop"
            type="button"
            aria-label="Zamknij koszyk"
            onClick={() => setCartOpen(false)}
          />
          <aside className="cart-panel" role="dialog" aria-modal="true" aria-labelledby="cart-title">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Twoje zamówienie</p>
                <h2 id="cart-title">{siteContent.navigation.cart} <span>({cartCount})</span></h2>
              </div>
              <button type="button" onClick={() => setCartOpen(false)} aria-label="Zamknij koszyk">
                ×
              </button>
            </div>

            {cartItems.length === 0 ? (
              <div className="empty-cart">
                <span aria-hidden="true">○</span>
                <h3>Twój koszyk jest pusty</h3>
                <p>Wybierz model, który najbardziej pasuje do Ciebie.</p>
                <button type="button" onClick={() => setCartOpen(false)}>
                  Wróć do kolekcji
                </button>
              </div>
            ) : (
              <>
                <div className="cart-items">
                  {cartItems.map((item) => (
                    <article className="cart-item" key={item.id}>
                      <div className={`cart-thumb ${item.tone}`}>
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="" />
                        ) : (
                          <span>{item.number}</span>
                        )}
                      </div>
                      <div className="cart-item-copy">
                        <h3>{item.name}</h3>
                        <p>{item.detail}</p>
                        <div className="quantity" aria-label={`Liczba sztuk: ${item.quantity}`}>
                          <button
                            type="button"
                            onClick={() => changeQuantity(item.id, -1)}
                            aria-label={`Usuń jedną sztukę ${item.name}`}
                          >
                            −
                          </button>
                          <span>{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => changeQuantity(item.id, 1)}
                            aria-label={`Dodaj jedną sztukę ${item.name}`}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <strong>{priceFormatter.format(item.price * item.quantity)}</strong>
                    </article>
                  ))}
                </div>

                <div className="cart-summary">
<div><span>Produkty</span><span>{priceFormatter.format(subtotal)}</span></div>
                  <div><span>Dostawa</span><span>{priceFormatter.format(delivery)}</span></div>
                  <div className="summary-total"><span>Razem</span><strong>{priceFormatter.format(total)}</strong></div>
                  <button className="checkout-button" type="button" onClick={openCheckout}>
                    Przejdź do płatności <span aria-hidden="true">→</span>
                  </button>
                  <small>Bezpieczna płatność Stripe: BLIK, karta lub obsługiwany portfel mobilny.</small>
                </div>
              </>
            )}
          </aside>
        </div>
      )}

      {checkoutOpen && (
        <div className="modal-layer checkout-layer">
          <button
            className="modal-backdrop"
            type="button"
            aria-label="Zamknij płatność"
            onClick={() => setCheckoutOpen(false)}
          />
          <section className="checkout-panel" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
            <div className="checkout-topbar">
              <button
                type="button"
                onClick={() => {
                  setCheckoutOpen(false);
                  setCartOpen(true);
                }}
              >
                ← Wróć do koszyka
              </button>
              <p className="wordmark checkout-wordmark"><span>{siteContent.brand.name}</span><small>{siteContent.brand.descriptor}</small></p>
              <button type="button" onClick={() => setCheckoutOpen(false)} aria-label="Zamknij płatność">×</button>
            </div>

            <div className="checkout-content">
              <form onSubmit={handleCheckout} aria-busy={checkoutPending}>
                <p className="eyebrow">Bezpieczne zamówienie · Stripe Checkout</p>
                <h2 id="checkout-title">Przejdź do płatności</h2>

                <fieldset>
                  <legend>Dane kontaktowe</legend>
                  <label className="field field-wide">
                    <span>Adres e-mail</span>
                    <input
                      type="email"
                      name="email"
                      autoComplete="email"
                      inputMode="email"
                      placeholder="twoj@email.pl"
                      aria-describedby="checkout-email-hint"
                      required
                    />
                    <small id="checkout-email-hint">Na ten adres wyślemy potwierdzenie zamówienia.</small>
                  </label>
                </fieldset>

                <div className="stripe-handoff">
                  <div>
                    <span>01</span>
                    <p><strong>Dostawa</strong>Adres i numer telefonu podasz bezpiecznie w Stripe.</p>
                  </div>
                  <div>
                    <span>02</span>
                    <p><strong>Płatność</strong>Wybierzesz BLIK lub kartę na szyfrowanej stronie.</p>
                  </div>
                  <div>
                    <span>03</span>
                    <p><strong>Potwierdzenie</strong>Po płatności wrócisz do sklepu z numerem zamówienia.</p>
                  </div>
                </div>

                <fieldset className="payment-fieldset">
                  <legend>Metoda płatności</legend>
                  <div className="payment-options" aria-label="Dostępne metody płatności">
                    <span className="payment-primary">BLIK</span>
                    <span>Karta</span>
                    <span>Portfel mobilny</span>
                  </div>
                  <p>Stripe pokaże metody dostępne dla urządzenia i przeglądarki klientki.</p>
                </fieldset>

                {checkoutError && (
                  <p
                    ref={checkoutErrorRef}
                    className="checkout-error"
                    role="alert"
                    aria-live="assertive"
                    aria-atomic="true"
                    tabIndex={-1}
                  >
                    {checkoutError}
                  </p>
                )}

                <button
                  className="pay-button"
                  type="submit"
                  disabled={checkoutPending || cartItems.length === 0}
                >
                  {checkoutPending ? "Łączenie ze Stripe…" : "Zapłać bezpiecznie ze Stripe"}
                </button>
                <p className="stripe-legal">Nie przechowujemy danych karty ani kodu BLIK. Płatność obsługuje Stripe.</p>
              </form>

              <aside className="checkout-summary" aria-label="Podsumowanie zamówienia">
                <p className="eyebrow">Podsumowanie</p>
                {cartItems.map((item) => (
                  <div className="checkout-item" key={item.id}>
                    <div className={`checkout-thumb ${item.tone}`}>
                      {item.imageUrl && <img src={item.imageUrl} alt="" />}
                      <span>{item.quantity}</span>
                    </div>
                    <div><strong>{item.name}</strong><small>{item.detail}</small></div>
                    <span>{priceFormatter.format(item.price * item.quantity)}</span>
                  </div>
                ))}
                <div className="checkout-totals">
                  <div><span>Produkty</span><span>{priceFormatter.format(subtotal)}</span></div>
                  <div><span>Dostawa</span><span>{priceFormatter.format(delivery)}</span></div>
                  <div><strong>Do zapłaty</strong><strong>{priceFormatter.format(total)}</strong></div>
                </div>
                <p className="secure-note">Kwoty są ponownie sprawdzane przez sklep przed utworzeniem płatności. Dane płatnicze trafiają bezpośrednio do Stripe.</p>
              </aside>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
