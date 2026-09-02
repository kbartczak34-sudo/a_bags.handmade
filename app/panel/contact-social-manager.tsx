"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  defaultSiteContent,
  type SiteContent,
  type SiteContentPayload,
} from "../../lib/site-content-shared";

type AdminPayload = Partial<SiteContentPayload> & {
  error?: string;
  message?: string;
};

async function readPayload(response: Response): Promise<AdminPayload> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as AdminPayload;
  } catch {
    throw new Error("Sklep zwrócił nieprawidłową odpowiedź.");
  }
}

export default function ContactSocialManager() {
  const [content, setContent] = useState<SiteContent>(defaultSiteContent);
  const [saved, setSaved] = useState<SiteContent>(defaultSiteContent);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/site-content", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await readPayload(response);
        if (!response.ok || !payload.content) {
          throw new Error(payload.error ?? "Nie udało się wczytać danych kontaktowych.");
        }
        return payload.content;
      })
      .then((next) => {
        setContent(next);
        setSaved(next);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "Nie udało się wczytać danych kontaktowych.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const setContact = <Key extends keyof SiteContent["contact"]>(
    key: Key,
    value: SiteContent["contact"][Key],
  ) => {
    setContent((current) => ({
      ...current,
      contact: { ...current.contact, [key]: value },
    }));
    setMessage("");
  };

  const setInstagram = <Key extends keyof SiteContent["instagram"]>(
    key: Key,
    value: SiteContent["instagram"][Key],
  ) => {
    setContent((current) => ({
      ...current,
      instagram: { ...current.instagram, [key]: value },
    }));
    setMessage("");
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const formData = new FormData();
      formData.set("content", JSON.stringify(content));
      formData.set("removeHeroImage", "false");
      const response = await fetch("/api/admin/site-content", {
        method: "POST",
        body: formData,
      });
      const payload = await readPayload(response);
      if (!response.ok || !payload.content) {
        throw new Error(payload.error ?? "Nie udało się zapisać kontaktu.");
      }
      setContent(payload.content);
      setSaved(payload.content);
      setMessage("Kontakt i social media zostały opublikowane w całym sklepie.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nie udało się zapisać kontaktu.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="admin-content-state">Wczytywanie kontaktu i social media…</p>;
  }

  return (
    <section className="admin-content-editor" aria-label="Kontakt i social media">
      <div className="admin-module-heading">
        <div>
          <p className="eyebrow">Kontakt i social media</p>
          <h2>Jedno miejsce dla wszystkich odnośników</h2>
          <p>
            Te dane zasilają pływające ikony, zapytania o produkty, konfigurator oraz ekran po zakupie.
          </p>
        </div>
        <span className="admin-live-badge">Globalne ustawienia</span>
      </div>

      <form className="site-editor-form" onSubmit={save}>
        <div className="site-editor-group-body site-editor-grid two-columns">
          <label className="admin-field admin-field-wide">
            <span>Numer WhatsApp</span>
            <input
              type="tel"
              value={content.contact.whatsappNumber}
              onChange={(event) => setContact("whatsappNumber", event.target.value)}
              maxLength={24}
              placeholder="np. +48 504 510 200"
              required
            />
            <small>Możesz wpisać numer ze spacjami i znakiem +. System zapisze bezpieczną wersję cyfrową.</small>
          </label>

          <label className="admin-field admin-field-wide">
            <span>Adres e-mail</span>
            <input
              type="email"
              value={content.contact.email}
              onChange={(event) => setContact("email", event.target.value)}
              maxLength={180}
              required
            />
            <small>Używany w sekcji kontaktu oraz odnośnikach e-mail.</small>
          </label>

          <label className="admin-field admin-field-wide">
            <span>Facebook</span>
            <input
              type="url"
              value={content.contact.facebookUrl}
              onChange={(event) => setContact("facebookUrl", event.target.value)}
              maxLength={300}
              placeholder="https://www.facebook.com/..."
              required
            />
            <small>Dozwolony jest bezpieczny adres HTTPS w domenie facebook.com.</small>
          </label>

          <label className="admin-field admin-field-wide">
            <span>Instagram</span>
            <input
              type="url"
              value={content.instagram.profileUrl}
              onChange={(event) => setInstagram("profileUrl", event.target.value)}
              maxLength={300}
              placeholder="https://www.instagram.com/..."
              required
            />
            <small>Dozwolony jest bezpieczny adres HTTPS w domenie instagram.com.</small>
          </label>

          <label className="admin-field admin-field-wide">
            <span>Nazwa profilu Instagram</span>
            <input
              type="text"
              value={content.instagram.handle}
              onChange={(event) => setInstagram("handle", event.target.value)}
              maxLength={80}
              placeholder="@a_bags.handmade"
              required
            />
            <small>Wyświetlana nazwa profilu na stronie.</small>
          </label>
        </div>

        {(message || error) && (
          <p className={`admin-message ${error ? "is-error" : "is-success"}`} role="status">
            {error || message}
          </p>
        )}

        <div className="site-editor-actions">
          <button
            className="is-secondary"
            type="button"
            onClick={() => {
              setContent(saved);
              setMessage("Przywrócono ostatnio zapisane dane.");
              setError("");
            }}
            disabled={saving}
          >
            Cofnij niezapisane zmiany
          </button>
          <button type="submit" disabled={saving}>
            {saving ? "Publikowanie…" : "Zapisz i opublikuj kontakt"}
          </button>
        </div>
      </form>
    </section>
  );
}
