"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePublicContact, whatsappHref } from "./public-contact";

type ProductAvailability = "ready" | "made_to_order" | "unavailable";

type ExperienceProduct = {
  id: string;
  name: string;
  detail: string;
  stitchType: string;
  price: number;
  imageUrl: string | null;
  availabilityStatus: ProductAvailability;
  availabilityNote: string;
};

type ModalKind = "quiz" | "configurator" | "wishlist" | null;

type ConfiguratorState = {
  productId: string;
  color: string;
  stitch: string;
  handles: string;
  accent: string;
};

const STORAGE_KEY = "abags-wishlist";

const availabilityLabels: Record<ProductAvailability, string> = {
  ready: "Dostępna od ręki",
  made_to_order: "Na zamówienie",
  unavailable: "Chwilowo niedostępna",
};

const money = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
});

function availabilityStatus(product: ExperienceProduct): ProductAvailability {
  return product.availabilityStatus === "ready" || product.availabilityStatus === "unavailable"
    ? product.availabilityStatus
    : "made_to_order";
}

function productWhatsAppMessage(product: ExperienceProduct) {
  const status = availabilityStatus(product);
  const availability = availabilityLabels[status];
  const note = product.availabilityNote?.trim();
  if (status === "unavailable") {
    return `Dzień dobry! Interesuje mnie ${product.name} (${money.format(product.price)}). Widzę status „${availability}”. Czy ten model można wykonać ponownie?${note ? ` Informacja w sklepie: ${note}` : ""}`;
  }
  return `Dzień dobry! Interesuje mnie ${product.name} (${money.format(product.price)}). Status w sklepie: ${availability}.${note ? ` ${note}` : ""} Czy mogę prosić o potwierdzenie terminu?`;
}

function scoreProduct(product: ExperienceProduct, answers: string[]) {
  const haystack = `${product.name} ${product.detail} ${product.stitchType}`.toLowerCase();
  let score = availabilityStatus(product) === "unavailable" ? -50 : 0;
  for (const answer of answers) {
    if (answer === "romantic" && /(róż|rose|lila|fiolet|pastel)/.test(haystack)) score += 4;
    if (answer === "natural" && /(beż|natural|piask|krem|sand)/.test(haystack)) score += 4;
    if (answer === "statement" && /(frędzl|fiolet|lila|wyraz)/.test(haystack)) score += 3;
    if (answer === "classic" && /(klasy|natural|beż|prosty)/.test(haystack)) score += 3;
    if (answer === "soft" && /(róż|pudrow|pastel|delikat)/.test(haystack)) score += 3;
    if (answer === "everyday" && /(klasy|natural|ręcznie|plecion)/.test(haystack)) score += 2;
    if (answer === "occasion" && /(frędzl|rose|lila|fiolet)/.test(haystack)) score += 2;
    if (answer === "gift") score += product.imageUrl ? 2 : 1;
  }
  return score;
}

function ProductThumb({ product }: { product: ExperienceProduct }) {
  return product.imageUrl ? (
    <img src={product.imageUrl} alt={product.name} loading="lazy" />
  ) : (
    <div className="abags-experience-placeholder" aria-hidden="true">◇</div>
  );
}

export default function StorefrontExperience() {
  const contact = usePublicContact();
  const [products, setProducts] = useState<ExperienceProduct[]>([]);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [quizStep, setQuizStep] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<string[]>([]);
  const [config, setConfig] = useState<ConfiguratorState>({
    productId: "",
    color: "",
    stitch: "",
    handles: "",
    accent: "",
  });
  const wishlistRestored = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/products", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("products unavailable");
        const data = (await response.json()) as { products?: ExperienceProduct[] };
        return Array.isArray(data.products) ? data.products : [];
      })
      .then((items) => setProducts(items))
      .catch(() => {
        if (!controller.signal.aborted) setProducts([]);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    let restored: string[] = [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) restored = parsed.filter((item): item is string => typeof item === "string");
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    queueMicrotask(() => {
      wishlistRestored.current = true;
      setWishlist(restored);
    });
  }, []);

  useEffect(() => {
    if (!wishlistRestored.current) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(wishlist));
    document.querySelectorAll<HTMLButtonElement>("[data-abags-wishlist-id]").forEach((button) => {
      const active = wishlist.includes(button.dataset.abagsWishlistId ?? "");
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
      button.setAttribute("aria-label", active ? "Usuń z ulubionych" : "Dodaj do ulubionych");
      button.textContent = active ? "♥" : "♡";
    });
    const header = document.querySelector<HTMLElement>(".abags-header-wishlist-count");
    if (header) header.textContent = String(wishlist.length);
  }, [wishlist]);

  useEffect(() => {
    const anchor = document.getElementById("historia") ?? document.getElementById("zalety") ?? document.getElementById("opinie") ?? document.getElementById("kontakt");
    if (!anchor?.parentElement) return;
    const mount = document.createElement("div");
    mount.className = "abags-experience-mount";
    anchor.parentElement.insertBefore(mount, anchor);
    const frame = window.requestAnimationFrame(() => setHost(mount));
    return () => {
      window.cancelAnimationFrame(frame);
      mount.remove();
    };
  }, []);

  useEffect(() => {
    if (products.length === 0) return;

    const enhance = () => {
      const byName = new Map(products.map((product) => [product.name.trim(), product]));
      document.querySelectorAll<HTMLElement>(".product-card").forEach((card) => {
        const name = card.querySelector<HTMLElement>(".product-info h3")?.textContent?.trim() ?? "";
        const product = byName.get(name);
        if (!product) return;
        card.dataset.abagsProductId = product.id;

        const status = availabilityStatus(product);
        const label = availabilityLabels[status];
        const note = product.availabilityNote?.trim() ?? "";
        const availabilityKey = `${status}|${note}`;
        card.dataset.abagsAvailabilityStatus = status;
        card.dataset.abagsAvailabilityLabel = label;
        card.dataset.abagsAvailabilityNote = note;

        const visual = card.querySelector<HTMLElement>(".product-visual");
        if (visual && !visual.querySelector(".abags-wishlist-toggle")) {
          const wishlistButton = document.createElement("button");
          wishlistButton.type = "button";
          wishlistButton.className = "abags-wishlist-toggle";
          wishlistButton.dataset.abagsWishlistId = product.id;
          wishlistButton.setAttribute("aria-pressed", "false");
          wishlistButton.setAttribute("aria-label", "Dodaj do ulubionych");
          wishlistButton.textContent = "♡";
          visual.appendChild(wishlistButton);
        }

        const addButton = card.querySelector<HTMLButtonElement>(".add-button");
        if (addButton && card.dataset.abagsAvailabilityKey !== availabilityKey) {
          card.dataset.abagsAvailabilityKey = availabilityKey;
          card.classList.toggle("is-unavailable", status === "unavailable");

          let meta = card.querySelector<HTMLElement>(".abags-premium-meta");
          if (!meta) {
            meta = document.createElement("div");
            meta.className = "abags-premium-meta";
            addButton.parentElement?.insertBefore(meta, addButton);
          }
          meta.innerHTML = `<span>Ręcznie wykonana</span><span class="abags-availability-pill is-${status}">${label}</span>${product.stitchType ? `<span>${product.stitchType}</span>` : ""}`;

          let availabilityCopy = card.querySelector<HTMLElement>(".abags-availability-copy");
          if (!availabilityCopy) {
            availabilityCopy = document.createElement("p");
            availabilityCopy.className = "abags-availability-copy";
            addButton.parentElement?.insertBefore(availabilityCopy, addButton);
          }
          availabilityCopy.textContent = note;
          availabilityCopy.hidden = !note;

          addButton.disabled = status === "unavailable";
          addButton.setAttribute(
            "aria-label",
            status === "unavailable"
              ? `${product.name} — chwilowo niedostępna`
              : `Dodaj ${product.name} do koszyka`,
          );
          addButton.innerHTML = status === "unavailable"
            ? "Chwilowo niedostępna"
            : "Dodaj do koszyka <span aria-hidden=\"true\">＋</span>";
        }

        if (addButton) {
          let link = card.querySelector<HTMLAnchorElement>(".abags-product-whatsapp");
          if (!link) {
            link = document.createElement("a");
            link.className = "abags-product-whatsapp";
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            addButton.parentElement?.insertBefore(link, addButton);
          }
          link.textContent = status === "unavailable"
            ? "Zapytaj o ponowne wykonanie na WhatsApp"
            : "Zapytaj o termin na WhatsApp";
          link.setAttribute("aria-label", `Zapytaj na WhatsApp o ${product.name}`);
          link.href = whatsappHref(contact.whatsappNumber, productWhatsAppMessage(product));
        }
      });

      const actions = document.querySelector<HTMLElement>(".header-actions");
      if (actions && !actions.querySelector(".abags-header-wishlist")) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "abags-header-wishlist";
        button.setAttribute("aria-label", "Otwórz ulubione produkty");
        button.innerHTML = `♡ <span class="abags-header-wishlist-count">${wishlist.length}</span>`;
        actions.insertBefore(button, actions.firstChild);
      }
    };

    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });

    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const wishButton = event.target.closest<HTMLButtonElement>("[data-abags-wishlist-id]");
      if (wishButton) {
        event.preventDefault();
        event.stopPropagation();
        const id = wishButton.dataset.abagsWishlistId;
        if (!id) return;
        setWishlist((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
        return;
      }
      if (event.target.closest(".abags-header-wishlist")) {
        event.preventDefault();
        setModal("wishlist");
      }
    };

    document.addEventListener("click", onClick);
    return () => {
      observer.disconnect();
      document.removeEventListener("click", onClick);
    };
  }, [products, wishlist.length, contact.whatsappNumber]);

  useEffect(() => {
    if (!modal) return;
    document.body.classList.add("modal-open");
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModal(null);
    };
    window.addEventListener("keydown", close);
    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", close);
    };
  }, [modal]);

  const stitchNames = useMemo(
    () => Array.from(new Set(products.map((product) => product.stitchType.trim()).filter(Boolean))),
    [products],
  );

  const wishlistProducts = useMemo(
    () => products.filter((product) => wishlist.includes(product.id)),
    [products, wishlist],
  );

  const quizResult = useMemo(() => {
    if (quizAnswers.length < 3 || products.length === 0) return null;
    const purchasable = products.filter((product) => availabilityStatus(product) !== "unavailable");
    const pool = purchasable.length > 0 ? purchasable : products;
    return [...pool].sort((a, b) => scoreProduct(b, quizAnswers) - scoreProduct(a, quizAnswers))[0] ?? null;
  }, [products, quizAnswers]);

  const openProduct = (product: ExperienceProduct) => {
    setModal(null);
    const card = document.querySelector<HTMLElement>(`.product-card[data-abags-product-id="${CSS.escape(product.id)}"]`);
    if (!card) {
      document.getElementById("kolekcja")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => card.querySelector<HTMLButtonElement>(".product-preview-trigger")?.click(), 350);
  };

  const startQuiz = () => {
    setQuizStep(0);
    setQuizAnswers([]);
    setModal("quiz");
  };

  const answerQuiz = (answer: string) => {
    setQuizAnswers((current) => [...current.slice(0, quizStep), answer]);
    setQuizStep((current) => Math.min(3, current + 1));
  };

  const startConfigurator = () => {
    setConfig({ productId: "", color: "", stitch: "", handles: "", accent: "" });
    setModal("configurator");
  };

  const configuredProduct = products.find((product) => product.id === config.productId) ?? null;
  const configurationReady = Boolean(config.productId && config.color && config.stitch && config.handles && config.accent);
  const configurationMessage = configuredProduct
    ? `Dzień dobry! Chciałabym stworzyć własną A-Bags. Model bazowy: ${configuredProduct.name}. Kolor: ${config.color}. Splot/ścieg: ${config.stitch}. Uchwyty: ${config.handles}. Dodatki: ${config.accent}. Proszę o informację o możliwości wykonania, terminie i cenie.`
    : "Dzień dobry! Chciałabym stworzyć własną torebkę A-Bags.";

  const experience = host ? createPortal(
    <div className="abags-experience-shell">
      <section className="abags-personal-shopping" aria-labelledby="personal-shopping-title">
        <div className="abags-experience-heading">
          <div>
            <p className="eyebrow">A-Bags Atelier</p>
            <h2 id="personal-shopping-title">Znajdź torebkę stworzoną dla Ciebie</h2>
          </div>
          <p>Odkrywaj kolekcję bardziej osobiście — przez rekomendację, własną konfigurację albo listę ulubionych modeli.</p>
        </div>
        <div className="abags-experience-actions">
          <button type="button" onClick={startQuiz}><span>01</span><strong>Znajdź swoją A-Bags</strong><small>3 krótkie pytania i rekomendacja modelu</small></button>
          <button type="button" onClick={startConfigurator}><span>02</span><strong>Stwórz własną torebkę</strong><small>Model, kolor, splot, uchwyty i detal</small></button>
          <button type="button" onClick={() => setModal("wishlist")}><span>03</span><strong>Moje ulubione ♡</strong><small>{wishlist.length ? `${wishlist.length} zapisanych modeli` : "Zapisuj modele bez zakładania konta"}</small></button>
        </div>
      </section>

      <section className="abags-lookbook" aria-labelledby="lookbook-title">
        <div className="abags-experience-heading">
          <div><p className="eyebrow">Lookbook</p><h2 id="lookbook-title">A-Bags w Twoim stylu</h2></div>
          <p>Potraktuj kolekcję jak mały modowy lookbook. Kliknij model, aby przejść prosto do jego szczegółów.</p>
        </div>
        <div className="abags-lookbook-grid">
          {products.slice(0, 6).map((product, index) => (
            <button type="button" className={index === 0 ? "is-featured" : ""} onClick={() => openProduct(product)} key={product.id}>
              <div className="abags-lookbook-media"><ProductThumb product={product} /></div>
              <div>
                <span>{product.stitchType || "Handmade"}</span>
                <strong>{product.name}</strong>
                <small>{money.format(product.price)} · {availabilityLabels[availabilityStatus(product)]} →</small>
              </div>
            </button>
          ))}
        </div>
      </section>

      {stitchNames.length > 0 && (
        <section className="abags-stitch-lexicon" aria-labelledby="stitch-lexicon-title">
          <div className="abags-experience-heading">
            <div><p className="eyebrow">Leksykon pracowni</p><h2 id="stitch-lexicon-title">Poznaj sploty A-Bags</h2></div>
            <p>Bez technicznego zgadywania: pokazujemy wyłącznie nazwy technik przypisane przez właścicielkę oraz modele, które faktycznie z nich korzystają.</p>
          </div>
          <div className="abags-lexicon-grid">
            {stitchNames.map((stitch) => {
              const matching = products.filter((product) => product.stitchType.trim() === stitch);
              return <article key={stitch}><span>{String(matching.length).padStart(2, "0")}</span><h3>{stitch}</h3><p>{matching.length === 1 ? "1 model w aktualnej kolekcji" : `${matching.length} modele w aktualnej kolekcji`}. Każdy możesz obejrzeć w galerii splotów.</p><button type="button" onClick={() => document.getElementById("sploty")?.scrollIntoView({ behavior: "smooth" })}>Przejdź do galerii →</button></article>;
            })}
          </div>
        </section>
      )}
    </div>, host) : null;

  return <>
    {experience}

    {modal && (
      <div className="abags-experience-modal-layer">
        <button className="abags-experience-backdrop" type="button" aria-label="Zamknij" onClick={() => setModal(null)} />
        <section className="abags-experience-modal" role="dialog" aria-modal="true" aria-label={modal === "quiz" ? "Znajdź swoją torebkę" : modal === "configurator" ? "Stwórz własną torebkę" : "Ulubione produkty"}>
          <button className="abags-experience-close" type="button" onClick={() => setModal(null)} aria-label="Zamknij">×</button>

          {modal === "wishlist" && <>
            <p className="eyebrow">Twoja kolekcja</p><h2>Ulubione modele ♡</h2>
            {wishlistProducts.length === 0 ? <div className="abags-experience-empty"><span>♡</span><strong>Jeszcze nic tu nie ma</strong><p>Dotknij serduszka przy dowolnej torebce. Zapis pozostanie na tym urządzeniu.</p><button type="button" onClick={() => { setModal(null); document.getElementById("kolekcja")?.scrollIntoView({ behavior: "smooth" }); }}>Odkryj kolekcję →</button></div> : <div className="abags-wishlist-grid">{wishlistProducts.map((product) => <article key={product.id}><div><ProductThumb product={product} /></div><section><h3>{product.name}</h3><p>{product.detail}</p><small>{availabilityLabels[availabilityStatus(product)]} · {product.availabilityNote}</small><strong>{money.format(product.price)}</strong><button type="button" onClick={() => openProduct(product)}>Zobacz produkt →</button><button type="button" className="is-secondary" onClick={() => setWishlist((current) => current.filter((id) => id !== product.id))}>Usuń z ulubionych</button></section></article>)}</div>}
          </>}

          {modal === "quiz" && <>
            <p className="eyebrow">Personal shopper · {Math.min(quizStep + 1, 3)}/3</p><h2>Znajdź swoją A-Bags</h2>
            {quizStep === 0 && <div className="abags-choice-grid"><button type="button" onClick={() => answerQuiz("romantic")}><strong>Pastele i romantyczny klimat</strong><small>Róż, lila, delikatne akcenty</small></button><button type="button" onClick={() => answerQuiz("natural")}><strong>Naturalnie i ponadczasowo</strong><small>Beże, kremy, spokojna paleta</small></button><button type="button" onClick={() => answerQuiz("statement")}><strong>Lubię mocniejszy akcent</strong><small>Torebka ma przyciągać uwagę</small></button></div>}
            {quizStep === 1 && <div className="abags-choice-grid"><button type="button" onClick={() => answerQuiz("everyday")}><strong>Na co dzień</strong><small>Uniwersalny model do wielu stylizacji</small></button><button type="button" onClick={() => answerQuiz("occasion")}><strong>Na wyjątkowe wyjścia</strong><small>Bardziej dekoracyjny charakter</small></button><button type="button" onClick={() => answerQuiz("gift")}><strong>Na prezent</strong><small>Chcę model z efektem „wow”</small></button></div>}
            {quizStep === 2 && <div className="abags-choice-grid"><button type="button" onClick={() => answerQuiz("soft")}><strong>Subtelna</strong><small>Miękka, kobieca estetyka</small></button><button type="button" onClick={() => answerQuiz("classic")}><strong>Klasyczna</strong><small>Prostota i ponadczasowość</small></button><button type="button" onClick={() => answerQuiz("statement")}><strong>Wyrazista</strong><small>Detal ma grać pierwszą rolę</small></button></div>}
            {quizStep >= 3 && quizResult && <div className="abags-quiz-result"><div><ProductThumb product={quizResult} /></div><section><span>Najlepsze dopasowanie · {availabilityLabels[availabilityStatus(quizResult)]}</span><h3>{quizResult.name}</h3><p>{quizResult.detail}</p><small>{quizResult.availabilityNote}</small><strong>{money.format(quizResult.price)}</strong><button type="button" onClick={() => openProduct(quizResult)}>Zobacz rekomendowany model →</button><button type="button" className="is-secondary" onClick={startQuiz}>Powtórz quiz</button></section></div>}
          </>}

          {modal === "configurator" && <>
            <p className="eyebrow">A-Bags Atelier</p><h2>Stwórz swoją torebkę</h2><p className="abags-modal-lead">To zapytanie o wykonanie indywidualne — przed realizacją potwierdzimy możliwość wykonania, cenę i termin.</p>
            <div className="abags-config-grid">
              <label><span>1. Model bazowy</span><select value={config.productId} onChange={(event) => setConfig({ ...config, productId: event.target.value })}><option value="">Wybierz model</option>{products.map((product) => <option value={product.id} key={product.id}>{product.name} · {availabilityLabels[availabilityStatus(product)]}</option>)}</select></label>
              <label><span>2. Kolor</span><select value={config.color} onChange={(event) => setConfig({ ...config, color: event.target.value })}><option value="">Wybierz kolor</option><option>Pudrowy róż</option><option>Fiolet / lila</option><option>Naturalny / beż</option><option>Inny kolor — do ustalenia</option></select></label>
              <label><span>3. Splot / ścieg</span><select value={config.stitch} onChange={(event) => setConfig({ ...config, stitch: event.target.value })}><option value="">Wybierz technikę</option>{stitchNames.map((stitch) => <option key={stitch}>{stitch}</option>)}<option>Do ustalenia z pracownią</option></select></label>
              <label><span>4. Uchwyty</span><select value={config.handles} onChange={(event) => setConfig({ ...config, handles: event.target.value })}><option value="">Wybierz</option><option>Klasyczne</option><option>Drewniane</option><option>Do ustalenia z pracownią</option></select></label>
              <label><span>5. Detal / dodatek</span><select value={config.accent} onChange={(event) => setConfig({ ...config, accent: event.target.value })}><option value="">Wybierz</option><option>Bez dodatkowego akcentu</option><option>Chusta / kokarda</option><option>Inny detal — do ustalenia</option></select></label>
            </div>
            <div className="abags-config-summary"><strong>Twoja konfiguracja</strong><p>{configuredProduct?.name || "Model — jeszcze nie wybrany"} · {config.color || "kolor"} · {config.stitch || "splot"} · {config.handles || "uchwyty"} · {config.accent || "detal"}</p></div>
            <a className={`abags-config-whatsapp${configurationReady ? "" : " is-disabled"}`} href={configurationReady ? whatsappHref(contact.whatsappNumber, configurationMessage) : undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!configurationReady}>Wyślij konfigurację na WhatsApp →</a>
          </>}
        </section>
      </div>
    )}
  </>;
}
