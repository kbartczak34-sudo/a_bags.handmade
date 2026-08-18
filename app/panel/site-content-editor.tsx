"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  defaultSiteContent,
  type SiteContent,
  type SiteContentPayload,
} from "../../lib/site-content-shared";

type AdminSitePayload = Partial<SiteContentPayload> & {
  error?: string;
  message?: string;
};

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  rows?: number;
  type?: "text" | "email" | "url";
  help?: string;
  placeholder?: string;
};

const MAX_SOURCE_IMAGE_BYTES = 30 * 1024 * 1024;
const TARGET_IMAGE_BYTES = 900 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function EditorField({
  label,
  value,
  onChange,
  maxLength,
  rows,
  type = "text",
  help,
  placeholder,
}: FieldProps) {
  return (
    <label className="admin-field admin-field-wide">
      <span>{label}</span>
      {rows ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={maxLength}
          rows={rows}
          placeholder={placeholder}
          required
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={maxLength}
          placeholder={placeholder}
          required
        />
      )}
      <small>{help ?? `${value.length}/${maxLength} znaków`}</small>
    </label>
  );
}

function VisibilitySwitch({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <label className="admin-switch admin-field-wide">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <small>{description}</small>
      </div>
    </label>
  );
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Nie udało się przygotować zdjęcia."));
      },
      "image/webp",
      quality,
    );
  });
}

async function prepareImageForUpload(file: File): Promise<File> {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Wybierz zdjęcie w formacie JPG, PNG lub WEBP.");
  }
  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error("Zdjęcie jest bardzo duże. Wybierz plik mniejszy niż 30 MB.");
  }
  if (file.size <= TARGET_IMAGE_BYTES) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Nie udało się odczytać tego zdjęcia.");
  }

  try {
    let maxDimension = 1800;
    let quality = 0.86;
    for (let attempt = 0; attempt < 7; attempt += 1) {
      const scale = Math.min(
        1,
        maxDimension / Math.max(bitmap.width, bitmap.height),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d", { alpha: true });
      if (!context) throw new Error("Nie udało się przygotować zdjęcia.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await canvasToBlob(canvas, quality);
      if (blob.size <= TARGET_IMAGE_BYTES) {
        return new File([blob], "zdjecie-glowne.webp", {
          type: "image/webp",
          lastModified: Date.now(),
        });
      }
      if (quality > 0.58) quality -= 0.1;
      else {
        maxDimension = Math.round(maxDimension * 0.78);
        quality = 0.72;
      }
    }
  } finally {
    bitmap.close();
  }
  throw new Error("Nie udało się wystarczająco zmniejszyć zdjęcia.");
}

async function readPayload(response: Response): Promise<AdminSitePayload> {
  const body = await response.text();
  if (!body) return {};
  try {
    return JSON.parse(body) as AdminSitePayload;
  } catch {
    if (response.status === 413 || /payload too large/i.test(body)) {
      throw new Error("Zdjęcie było zbyt duże. Wybierz je ponownie.");
    }
    throw new Error("Sklep zwrócił nieprawidłową odpowiedź.");
  }
}

export default function SiteContentEditor() {
  const [content, setContent] = useState<SiteContent>(defaultSiteContent);
  const [savedContent, setSavedContent] = useState<SiteContent>(defaultSiteContent);
  const [heroImageUrl, setHeroImageUrl] = useState("/images/limitowana-kolekcja.jpg");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [removeHeroImage, setRemoveHeroImage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStage, setSaveStage] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const localPreview = useMemo(
    () => (imageFile ? URL.createObjectURL(imageFile) : null),
    [imageFile],
  );
  const visibleHeroImage = removeHeroImage ? null : localPreview || heroImageUrl;

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/site-content", { cache: "no-store" })
      .then(async (response) => {
        const data = await readPayload(response);
        if (!response.ok || !data.content) {
          throw new Error(data.error ?? "Nie udało się otworzyć treści strony.");
        }
        return data as SiteContentPayload;
      })
      .then((data) => {
        if (!active) return;
        setContent(data.content);
        setSavedContent(data.content);
        setHeroImageUrl(data.heroImageUrl);
      })
      .catch((reason) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Nie udało się otworzyć treści strony.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const updateSection = <
    Section extends keyof SiteContent,
    Key extends keyof SiteContent[Section],
  >(
    section: Section,
    key: Key,
    value: SiteContent[Section][Key],
  ) => {
    setContent((current) => ({
      ...current,
      [section]: { ...current[section], [key]: value },
    }));
    setMessage("");
  };

  const updateBenefit = (
    index: number,
    key: "title" | "description",
    value: string,
  ) => {
    setContent((current) => {
      const items = current.benefits.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      );
      return {
        ...current,
        benefits: { ...current.benefits, items },
      };
    });
    setMessage("");
  };

  const clearImageFile = () => {
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const restoreSaved = () => {
    setContent(savedContent);
    setRemoveHeroImage(false);
    clearImageFile();
    setMessage("Przywrócono ostatnio zapisane wartości.");
    setError("");
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    let uploadImage: File | null = null;
    try {
      setSaveStage(imageFile ? "Przygotowywanie zdjęcia…" : "Zapisywanie treści…");
      uploadImage = imageFile ? await prepareImageForUpload(imageFile) : null;
      const formData = new FormData();
      formData.set("content", JSON.stringify(content));
      formData.set("removeHeroImage", String(removeHeroImage));
      if (uploadImage) formData.set("heroImage", uploadImage);

      setSaveStage("Publikowanie zmian…");
      const response = await fetch("/api/admin/site-content", {
        method: "POST",
        body: formData,
      });
      const data = await readPayload(response);
      if (!response.ok || !data.content || !data.heroImageUrl) {
        throw new Error(data.error ?? "Nie udało się zapisać strony.");
      }

      setContent(data.content);
      setSavedContent(data.content);
      setHeroImageUrl(data.heroImageUrl);
      setRemoveHeroImage(false);
      clearImageFile();
      setMessage(data.message ?? "Zmiany na stronie zostały zapisane.");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Nie udało się zapisać strony.",
      );
    } finally {
      setSaving(false);
      setSaveStage("");
    }
  };

  return (
    <section className="admin-content-editor" aria-label="Edycja treści całej strony">
      <div className="admin-module-heading">
        <div>
          <p className="eyebrow">Treść całej strony</p>
          <p>
            Zapisane zmiany pojawią się w sklepie od razu. Otwieraj tylko tę
            część, którą chcesz zmienić.
          </p>
        </div>
        <span className="admin-live-badge">Zmiany na żywo</span>
      </div>

      {loading ? (
        <p className="admin-content-state">Wczytywanie treści strony…</p>
      ) : (
        <form className="site-editor-form" onSubmit={handleSave}>
          <details className="site-editor-group" open>
            <summary>
              <span>01</span>
              <div><strong>Marka, pasek i menu</strong><small>Logo tekstowe, komunikaty i nazwy odnośników</small></div>
            </summary>
            <div className="site-editor-group-body">
              <VisibilitySwitch
                checked={content.announcement.visible}
                onChange={(value) => updateSection("announcement", "visible", value)}
                title="Pokaż pasek informacyjny"
                description="Wyłącz, aby ukryć górny pasek nad menu."
              />
              <div className="site-editor-grid two-columns">
                <EditorField label="Pierwszy komunikat" value={content.announcement.primary} onChange={(value) => updateSection("announcement", "primary", value)} maxLength={140} />
                <EditorField label="Drugi komunikat" value={content.announcement.secondary} onChange={(value) => updateSection("announcement", "secondary", value)} maxLength={140} />
                <EditorField label="Nazwa marki" value={content.brand.name} onChange={(value) => updateSection("brand", "name", value)} maxLength={40} />
                <EditorField label="Dopisek pod nazwą" value={content.brand.descriptor} onChange={(value) => updateSection("brand", "descriptor", value)} maxLength={40} />
              </div>
              <div className="site-editor-grid five-columns">
                <EditorField label="Kolekcja" value={content.navigation.collection} onChange={(value) => updateSection("navigation", "collection", value)} maxLength={40} />
                <EditorField label="O marce" value={content.navigation.story} onChange={(value) => updateSection("navigation", "story", value)} maxLength={40} />
                <EditorField label="Opinie" value={content.navigation.reviews} onChange={(value) => updateSection("navigation", "reviews", value)} maxLength={40} />
                <EditorField label="Kontakt" value={content.navigation.contact} onChange={(value) => updateSection("navigation", "contact", value)} maxLength={40} />
                <EditorField label="Koszyk" value={content.navigation.cart} onChange={(value) => updateSection("navigation", "cart", value)} maxLength={40} />
              </div>
            </div>
          </details>

          <details className="site-editor-group" open>
            <summary>
              <span>02</span>
              <div><strong>Sekcja główna</strong><small>Nagłówek, przyciski, wyróżniki i zdjęcie</small></div>
            </summary>
            <div className="site-editor-group-body hero-editor-layout">
              <div className="admin-image-field site-hero-image-field">
                <div className={`admin-image-preview site-hero-preview ${visibleHeroImage ? "has-image" : ""}`}>
                  {visibleHeroImage ? (
                    <img src={visibleHeroImage} alt="Podgląd zdjęcia głównego" />
                  ) : (
                    <div><span aria-hidden="true">◇</span><strong>Zdjęcie główne</strong><small>JPG, PNG lub WEBP</small></div>
                  )}
                </div>
                <div className="admin-image-actions">
                  <label>
                    <span>{visibleHeroImage ? "Zmień zdjęcie" : "Dodaj zdjęcie"}</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setError("");
                        if (file && !ACCEPTED_IMAGE_TYPES.has(file.type)) {
                          setError("Wybierz zdjęcie w formacie JPG, PNG lub WEBP.");
                          clearImageFile();
                          return;
                        }
                        if (file && file.size > MAX_SOURCE_IMAGE_BYTES) {
                          setError("Zdjęcie jest bardzo duże. Wybierz plik mniejszy niż 30 MB.");
                          clearImageFile();
                          return;
                        }
                        setImageFile(file);
                        setRemoveHeroImage(false);
                      }}
                    />
                  </label>
                  {visibleHeroImage && (
                    <button type="button" onClick={() => { clearImageFile(); setRemoveHeroImage(true); }}>
                      Przywróć domyślne
                    </button>
                  )}
                </div>
              </div>
              <div className="site-editor-grid two-columns">
                <EditorField label="Etykieta nad nagłówkiem" value={content.hero.badge} onChange={(value) => updateSection("hero", "badge", value)} maxLength={120} />
                <EditorField label="Pierwsza część nagłówka" value={content.hero.title} onChange={(value) => updateSection("hero", "title", value)} maxLength={110} />
                <EditorField label="Wyróżniona część nagłówka" value={content.hero.accent} onChange={(value) => updateSection("hero", "accent", value)} maxLength={110} />
                <EditorField label="Opis główny" value={content.hero.lead} onChange={(value) => updateSection("hero", "lead", value)} maxLength={500} rows={5} />
                <EditorField label="Główny przycisk" value={content.hero.primaryCta} onChange={(value) => updateSection("hero", "primaryCta", value)} maxLength={70} />
                <EditorField label="Drugi odnośnik" value={content.hero.secondaryCta} onChange={(value) => updateSection("hero", "secondaryCta", value)} maxLength={70} />
                <EditorField label="Wyróżnik 1" value={content.hero.noteOne} onChange={(value) => updateSection("hero", "noteOne", value)} maxLength={70} />
                <EditorField label="Wyróżnik 2" value={content.hero.noteTwo} onChange={(value) => updateSection("hero", "noteTwo", value)} maxLength={70} />
                <EditorField label="Wyróżnik 3" value={content.hero.noteThree} onChange={(value) => updateSection("hero", "noteThree", value)} maxLength={70} />
                <EditorField label="Opis zdjęcia dla dostępności" value={content.hero.imageAlt} onChange={(value) => updateSection("hero", "imageAlt", value)} maxLength={220} />
                <EditorField label="Etykieta na zdjęciu" value={content.hero.imageLabel} onChange={(value) => updateSection("hero", "imageLabel", value)} maxLength={70} />
                <EditorField label="Dopisek na zdjęciu" value={content.hero.imageSublabel} onChange={(value) => updateSection("hero", "imageSublabel", value)} maxLength={70} />
                <EditorField label="Podpis pod zdjęciem" value={content.hero.imageCaption} onChange={(value) => updateSection("hero", "imageCaption", value)} maxLength={90} />
              </div>
            </div>
          </details>

          <details className="site-editor-group">
            <summary>
              <span>03</span>
              <div><strong>Kolekcja produktów</strong><small>Nagłówki i tekst pustej kolekcji</small></div>
            </summary>
            <div className="site-editor-group-body site-editor-grid two-columns">
              <EditorField label="Mały nagłówek" value={content.collection.eyebrow} onChange={(value) => updateSection("collection", "eyebrow", value)} maxLength={70} />
              <EditorField label="Tytuł sekcji" value={content.collection.title} onChange={(value) => updateSection("collection", "title", value)} maxLength={140} />
              <EditorField label="Etykieta kolekcji" value={content.collection.noteLabel} onChange={(value) => updateSection("collection", "noteLabel", value)} maxLength={80} />
              <EditorField label="Opis kolekcji" value={content.collection.noteText} onChange={(value) => updateSection("collection", "noteText", value)} maxLength={360} rows={4} />
              <EditorField label="Tytuł przy braku produktów" value={content.collection.emptyTitle} onChange={(value) => updateSection("collection", "emptyTitle", value)} maxLength={120} />
              <EditorField label="Opis przy braku produktów" value={content.collection.emptyText} onChange={(value) => updateSection("collection", "emptyText", value)} maxLength={260} rows={3} />
            </div>
          </details>

          <details className="site-editor-group">
            <summary>
              <span>04</span>
              <div><strong>O marce</strong><small>Historia i odnośnik do wiadomości e-mail</small></div>
            </summary>
            <div className="site-editor-group-body">
              <VisibilitySwitch checked={content.story.visible} onChange={(value) => updateSection("story", "visible", value)} title="Pokaż sekcję O marce" description="Sekcję można ukryć bez usuwania jej treści." />
              <div className="site-editor-grid two-columns">
                <EditorField label="Mały nagłówek" value={content.story.eyebrow} onChange={(value) => updateSection("story", "eyebrow", value)} maxLength={70} />
                <EditorField label="Tytuł" value={content.story.title} onChange={(value) => updateSection("story", "title", value)} maxLength={140} />
                <EditorField label="Historia marki" value={content.story.description} onChange={(value) => updateSection("story", "description", value)} maxLength={900} rows={7} />
                <EditorField label="Tekst odnośnika e-mail" value={content.story.cta} onChange={(value) => updateSection("story", "cta", value)} maxLength={120} />
              </div>
            </div>
          </details>

          <details className="site-editor-group">
            <summary>
              <span>05</span>
              <div><strong>Zalety marki</strong><small>Nagłówek oraz trzy najważniejsze wyróżniki</small></div>
            </summary>
            <div className="site-editor-group-body">
              <VisibilitySwitch checked={content.benefits.visible} onChange={(value) => updateSection("benefits", "visible", value)} title="Pokaż zalety" description="Wyłącz, aby ukryć cały blok zalet." />
              <div className="site-editor-grid two-columns">
                <EditorField label="Mały nagłówek" value={content.benefits.eyebrow} onChange={(value) => updateSection("benefits", "eyebrow", value)} maxLength={70} />
                <EditorField label="Tytuł sekcji" value={content.benefits.title} onChange={(value) => updateSection("benefits", "title", value)} maxLength={140} />
              </div>
              <div className="benefit-editor-grid">
                {content.benefits.items.map((item, index) => (
                  <fieldset key={index}>
                    <legend>Zaleta {index + 1}</legend>
                    <EditorField label="Tytuł" value={item.title} onChange={(value) => updateBenefit(index, "title", value)} maxLength={90} />
                    <EditorField label="Opis" value={item.description} onChange={(value) => updateBenefit(index, "description", value)} maxLength={260} rows={4} />
                  </fieldset>
                ))}
              </div>
            </div>
          </details>

          <details className="site-editor-group">
            <summary>
              <span>06</span>
              <div><strong>Opinie klientek</strong><small>Nagłówki, pusty stan i formularz opinii</small></div>
            </summary>
            <div className="site-editor-group-body">
              <VisibilitySwitch checked={content.reviews.visible} onChange={(value) => updateSection("reviews", "visible", value)} title="Pokaż opinie i formularz" description="Wyłącz, aby tymczasowo ukryć całą sekcję." />
              <div className="site-editor-grid two-columns">
                <EditorField label="Mały nagłówek" value={content.reviews.eyebrow} onChange={(value) => updateSection("reviews", "eyebrow", value)} maxLength={70} />
                <EditorField label="Tytuł sekcji" value={content.reviews.title} onChange={(value) => updateSection("reviews", "title", value)} maxLength={160} />
                <EditorField label="Tekst przed pierwszą opinią" value={content.reviews.emptyText} onChange={(value) => updateSection("reviews", "emptyText", value)} maxLength={300} rows={4} />
                <EditorField label="Podpis pustej opinii" value={content.reviews.emptyBrand} onChange={(value) => updateSection("reviews", "emptyBrand", value)} maxLength={80} />
                <EditorField label="Dopisek pustej opinii" value={content.reviews.emptyLabel} onChange={(value) => updateSection("reviews", "emptyLabel", value)} maxLength={100} />
                <EditorField label="Mały nagłówek formularza" value={content.reviews.formEyebrow} onChange={(value) => updateSection("reviews", "formEyebrow", value)} maxLength={70} />
                <EditorField label="Tytuł formularza" value={content.reviews.formTitle} onChange={(value) => updateSection("reviews", "formTitle", value)} maxLength={100} />
                <EditorField label="Opis formularza" value={content.reviews.formDescription} onChange={(value) => updateSection("reviews", "formDescription", value)} maxLength={360} rows={4} />
              </div>
            </div>
          </details>

          <details className="site-editor-group">
            <summary>
              <span>07</span>
              <div><strong>Instagram i kontakt</strong><small>Profil społecznościowy, e-mail i stopka</small></div>
            </summary>
            <div className="site-editor-group-body">
              <VisibilitySwitch checked={content.instagram.visible} onChange={(value) => updateSection("instagram", "visible", value)} title="Pokaż Instagram" description="Wyłącz, aby ukryć osadzony profil i nagłówek." />
              <div className="site-editor-grid two-columns">
                <EditorField label="Mały nagłówek Instagrama" value={content.instagram.eyebrow} onChange={(value) => updateSection("instagram", "eyebrow", value)} maxLength={70} />
                <EditorField label="Tytuł Instagrama" value={content.instagram.title} onChange={(value) => updateSection("instagram", "title", value)} maxLength={140} />
                <EditorField label="Nazwa profilu" value={content.instagram.handle} onChange={(value) => updateSection("instagram", "handle", value)} maxLength={80} />
                <EditorField label="Adres profilu Instagram" value={content.instagram.profileUrl} onChange={(value) => updateSection("instagram", "profileUrl", value)} maxLength={300} type="url" help="Pełny adres zaczynający się od https://www.instagram.com/" />
                <EditorField label="Opis nad profilem" value={content.instagram.feedNote} onChange={(value) => updateSection("instagram", "feedNote", value)} maxLength={240} rows={3} />
                <EditorField label="Adres e-mail" value={content.contact.email} onChange={(value) => updateSection("contact", "email", value)} maxLength={180} type="email" help="Ten adres otworzy się po kliknięciu kontaktu i odnośnika O marce." />
              </div>
              <div className="site-editor-subheading"><strong>Stopka strony</strong></div>
              <div className="site-editor-grid two-columns">
                <EditorField label="Opis marki" value={content.footer.tagline} onChange={(value) => updateSection("footer", "tagline", value)} maxLength={260} rows={3} />
                <EditorField label="Nagłówek linków sklepu" value={content.footer.shopLabel} onChange={(value) => updateSection("footer", "shopLabel", value)} maxLength={50} />
                <EditorField label="Nagłówek kontaktu" value={content.footer.socialLabel} onChange={(value) => updateSection("footer", "socialLabel", value)} maxLength={50} />
                <EditorField label="Link do kolekcji" value={content.footer.collectionLink} onChange={(value) => updateSection("footer", "collectionLink", value)} maxLength={50} />
                <EditorField label="Link do historii" value={content.footer.storyLink} onChange={(value) => updateSection("footer", "storyLink", value)} maxLength={50} />
                <EditorField label="Link do opinii" value={content.footer.reviewsLink} onChange={(value) => updateSection("footer", "reviewsLink", value)} maxLength={50} />
                <EditorField label="Nazwa linku Instagram" value={content.footer.instagramLink} onChange={(value) => updateSection("footer", "instagramLink", value)} maxLength={50} />
                <EditorField label="Nazwa linku e-mail" value={content.footer.emailLink} onChange={(value) => updateSection("footer", "emailLink", value)} maxLength={50} />
                <EditorField label="Prawa autorskie" value={content.footer.copyright} onChange={(value) => updateSection("footer", "copyright", value)} maxLength={100} />
                <EditorField label="Dopisek na dole" value={content.footer.statusText} onChange={(value) => updateSection("footer", "statusText", value)} maxLength={160} />
              </div>
            </div>
          </details>

          <details className="site-editor-group">
            <summary>
              <span>08</span>
              <div><strong>Kolory sklepu</strong><small>Główna paleta całej strony</small></div>
            </summary>
            <div className="site-editor-group-body theme-editor-grid">
              {([
                ["ink", "Tekst i ciemne tło"],
                ["paper", "Tło strony"],
                ["cream", "Jasne powierzchnie"],
                ["accent", "Różowy akcent"],
                ["accentDark", "Ciemny akcent"],
                ["accentLight", "Jasny akcent"],
              ] as const).map(([key, label]) => (
                <label className="theme-color-field" key={key}>
                  <input type="color" value={content.theme[key]} onChange={(event) => updateSection("theme", key, event.target.value)} />
                  <span><strong>{label}</strong><small>{content.theme[key]}</small></span>
                </label>
              ))}
            </div>
          </details>

          {(message || error) && (
            <p className={`admin-message ${error ? "is-error" : "is-success"}`} role="status">
              {error || message}
            </p>
          )}

          <div className="site-editor-actions">
            <button className="is-secondary" type="button" onClick={restoreSaved} disabled={saving}>
              Cofnij niezapisane zmiany
            </button>
            <button type="submit" disabled={saving}>
              {saving ? saveStage || "Zapisywanie…" : "Zapisz i opublikuj zmiany"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
