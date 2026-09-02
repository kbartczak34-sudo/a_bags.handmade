"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type AdminProduct = {
  id: string;
  name: string;
  detail: string;
  priceCents: number;
  sortOrder: number;
  isVisible: boolean;
  imageUrl: string | null;
  updatedAt: string;
};

type Editor = {
  id: string;
  name: string;
  detail: string;
  price: string;
  sortOrder: string;
  isVisible: boolean;
  imageUrl: string | null;
};

type ApiPayload = {
  error?: string;
  id?: string;
  products?: AdminProduct[];
};

const MAX_SOURCE_IMAGE_BYTES = 30 * 1024 * 1024;
const TARGET_IMAGE_BYTES = 900 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const emptyEditor: Editor = {
  id: "",
  name: "",
  detail: "",
  price: "",
  sortOrder: "10",
  isVisible: true,
  imageUrl: null,
};

function editorFromProduct(product: AdminProduct): Editor {
  return {
    id: product.id,
    name: product.name,
    detail: product.detail,
    price: (product.priceCents / 100).toFixed(2).replace(".", ","),
    sortOrder: String(product.sortOrder),
    isVisible: product.isVisible,
    imageUrl: product.imageUrl,
  };
}

async function readApiPayload(response: Response): Promise<ApiPayload> {
  const body = await response.text();
  if (!body) return {};

  try {
    return JSON.parse(body) as ApiPayload;
  } catch {
    if (response.status === 413 || /payload too large/i.test(body)) {
      throw new Error(
        "Zdjęcie było zbyt duże do wysłania. Wybierz je ponownie — panel automatycznie je zmniejszy.",
      );
    }
    throw new Error("Sklep zwrócił nieprawidłową odpowiedź. Spróbuj ponownie.");
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
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
    throw new Error(
      "Nie udało się odczytać tego zdjęcia. Wybierz plik JPG, PNG lub WEBP.",
    );
  }

  try {
    let maxDimension = 1800;
    let quality = 0.86;

    for (let attempt = 0; attempt < 7; attempt += 1) {
      const scale = Math.min(
        1,
        maxDimension / Math.max(bitmap.width, bitmap.height),
      );
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: true });
      if (!context) throw new Error("Nie udało się przygotować zdjęcia.");
      context.drawImage(bitmap, 0, 0, width, height);

      const blob = await canvasToBlob(canvas, quality);
      if (blob.size <= TARGET_IMAGE_BYTES) {
        const baseName = file.name.replace(/\.[^.]+$/, "") || "produkt";
        return new File([blob], `${baseName}.webp`, {
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

  throw new Error(
    "Nie udało się wystarczająco zmniejszyć zdjęcia. Wybierz inne ujęcie.",
  );
}

export default function ProductPanel() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [editor, setEditor] = useState<Editor>(emptyEditor);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
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

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/products", { cache: "no-store" })
      .then(async (response) => {
        const data = await readApiPayload(response);
        if (!response.ok) throw new Error(data.error ?? "Nie udało się otworzyć panelu.");
        return data.products ?? [];
      })
      .then((items) => {
        if (!active) return;
        setProducts(items);
        if (items[0]) setEditor(editorFromProduct(items[0]));
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Nie udało się otworzyć panelu.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const clearFile = () => {
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const selectProduct = (product: AdminProduct) => {
    setEditor(editorFromProduct(product));
    setRemoveImage(false);
    clearFile();
    setMessage("");
    setError("");
  };

  const startNewProduct = () => {
    const highestOrder = products.reduce(
      (highest, product) => Math.max(highest, product.sortOrder),
      0,
    );
    setEditor({ ...emptyEditor, sortOrder: String(highestOrder + 10) });
    setRemoveImage(false);
    clearFile();
    setMessage("");
    setError("");
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      setSaveStage(imageFile ? "Przygotowywanie zdjęcia…" : "Zapisywanie…");
      const uploadImage = imageFile
        ? await prepareImageForUpload(imageFile)
        : null;
      const formData = new FormData();
      if (editor.id) formData.set("id", editor.id);
      formData.set("name", editor.name);
      formData.set("detail", editor.detail);
      formData.set("price", editor.price);
      formData.set("sortOrder", editor.sortOrder);
      formData.set("isVisible", String(editor.isVisible));
      formData.set("removeImage", String(removeImage));
      if (uploadImage) formData.set("image", uploadImage);

      setSaveStage("Wysyłanie zmian…");
      const response = await fetch("/api/admin/products", {
        method: "POST",
        body: formData,
      });
      const data = await readApiPayload(response);
      if (!response.ok) throw new Error(data.error ?? "Nie udało się zapisać produktu.");

      const items = data.products ?? [];
      const selectedId = editor.id || String(data.id ?? "");
      const selected = items.find((product) => product.id === selectedId) ?? items[0];
      setProducts(items);
      setEditor(selected ? editorFromProduct(selected) : emptyEditor);
      setRemoveImage(false);
      clearFile();
      setMessage(editor.id ? "Zmiany zostały zapisane." : "Nowy produkt został dodany.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nie udało się zapisać produktu.");
    } finally {
      setSaving(false);
      setSaveStage("");
    }
  };

  const handleDelete = async () => {
    if (!editor.id) return;
    const confirmed = window.confirm(
      `Czy na pewno usunąć produkt „${editor.name}”? Tej operacji nie można cofnąć.`,
    );
    if (!confirmed) return;

    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(
        `/api/admin/products?id=${encodeURIComponent(editor.id)}`,
        { method: "DELETE" },
      );
      const data = await readApiPayload(response);
      if (!response.ok) throw new Error(data.error ?? "Nie udało się usunąć produktu.");
      const items = data.products ?? [];
      setProducts(items);
      setEditor(items[0] ? editorFromProduct(items[0]) : emptyEditor);
      setRemoveImage(false);
      clearFile();
      setMessage("Produkt został usunięty.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nie udało się usunąć produktu.");
    } finally {
      setSaving(false);
    }
  };

  const visibleImage = removeImage ? null : localPreview || editor.imageUrl;

  return (
    <section className="admin-products" aria-labelledby="admin-products-title">
      <div className="admin-module-heading admin-products-heading">
        <div>
          <p className="eyebrow">Katalog produktów</p>
          <h2 id="admin-products-title">Twoje produkty</h2>
          <p>Dodawaj torebki i zmieniaj ich zdjęcia, ceny oraz widoczność bez edycji kodu.</p>
        </div>
        <button className="admin-new-button" type="button" onClick={startNewProduct}>
          <span aria-hidden="true">＋</span> Dodaj produkt
        </button>
      </div>

      <div className="admin-layout">
        <aside className="admin-product-list" aria-label="Lista produktów">
          <div className="admin-list-heading">
            <strong>Produkty</strong>
            <span>{products.length}</span>
          </div>
          {loading ? (
            <p className="admin-list-state">Wczytywanie produktów…</p>
          ) : products.length === 0 ? (
            <p className="admin-list-state">Nie masz jeszcze produktów. Dodaj pierwszy model.</p>
          ) : (
            products.map((product, index) => (
              <button
                className={`admin-product-row ${editor.id === product.id ? "is-active" : ""}`}
                type="button"
                onClick={() => selectProduct(product)}
                key={product.id}
              >
                <span className="admin-product-miniature">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt="" />
                  ) : (
                    String(index + 1).padStart(2, "0")
                  )}
                </span>
                <span>
                  <strong>{product.name}</strong>
                  <small>{(product.priceCents / 100).toFixed(2).replace(".", ",")} zł</small>
                </span>
                <span className={`admin-visibility ${product.isVisible ? "is-visible" : ""}`}>
                  {product.isVisible ? "Widoczny" : "Ukryty"}
                </span>
              </button>
            ))
          )}
        </aside>

        <section className="admin-editor" aria-labelledby="editor-title">
          <div className="admin-editor-heading">
            <div>
              <p className="eyebrow">{editor.id ? "Edycja produktu" : "Nowy produkt"}</p>
              <h2 id="editor-title">{editor.id ? editor.name : "Dodaj nową torebkę"}</h2>
            </div>
            {editor.id && (
              <button className="admin-delete-button" type="button" onClick={handleDelete} disabled={saving}>
                Usuń
              </button>
            )}
          </div>

          <form className="admin-form" onSubmit={handleSave}>
            <div className="admin-image-field">
              <div className={`admin-image-preview ${visibleImage ? "has-image" : ""}`}>
                {visibleImage ? (
                  <img src={visibleImage} alt="Podgląd zdjęcia produktu" />
                ) : (
                  <div>
                    <span aria-hidden="true">◇</span>
                    <strong>Zdjęcie produktu</strong>
                    <small>JPG, PNG lub WEBP · duże zdjęcia zmniejszamy automatycznie</small>
                  </div>
                )}
              </div>
              <div className="admin-image-actions">
                <label>
                  <span>{visibleImage ? "Zmień zdjęcie" : "Dodaj zdjęcie"}</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      const selectedFile = event.target.files?.[0] ?? null;
                      setError("");
                      if (
                        selectedFile &&
                        !ACCEPTED_IMAGE_TYPES.has(selectedFile.type)
                      ) {
                        setError("Wybierz zdjęcie w formacie JPG, PNG lub WEBP.");
                        clearFile();
                        return;
                      }
                      if (
                        selectedFile &&
                        selectedFile.size > MAX_SOURCE_IMAGE_BYTES
                      ) {
                        setError("Zdjęcie jest bardzo duże. Wybierz plik mniejszy niż 30 MB.");
                        clearFile();
                        return;
                      }
                      setImageFile(selectedFile);
                      setRemoveImage(false);
                    }}
                  />
                </label>
                {visibleImage && (
                  <button
                    type="button"
                    onClick={() => {
                      clearFile();
                      setRemoveImage(true);
                    }}
                  >
                    Usuń zdjęcie
                  </button>
                )}
              </div>
            </div>

            <div className="admin-fields">
              <label className="admin-field admin-field-wide">
                <span>Nazwa produktu</span>
                <input
                  value={editor.name}
                  onChange={(event) => setEditor({ ...editor, name: event.target.value })}
                  placeholder="np. Torebka Amelia"
                  maxLength={80}
                  required
                />
              </label>
              <label className="admin-field admin-field-wide">
                <span>Krótki opis</span>
                <textarea
                  value={editor.detail}
                  onChange={(event) => setEditor({ ...editor, detail: event.target.value })}
                  placeholder="np. Pudrowy róż · ręcznie pleciona"
                  maxLength={180}
                  rows={3}
                />
                <small>{editor.detail.length}/180 znaków</small>
              </label>
              <label className="admin-field">
                <span>Cena brutto</span>
                <div className="admin-price-input">
                  <input
                    value={editor.price}
                    onChange={(event) => setEditor({ ...editor, price: event.target.value })}
                    inputMode="decimal"
                    placeholder="199,00"
                    required
                  />
                  <span>zł</span>
                </div>
              </label>
              <label className="admin-field">
                <span>Kolejność</span>
                <input
                  type="number"
                  min="0"
                  max="9999"
                  value={editor.sortOrder}
                  onChange={(event) => setEditor({ ...editor, sortOrder: event.target.value })}
                  required
                />
                <small>Niższa liczba wyświetla produkt wcześniej.</small>
              </label>
              <label className="admin-switch admin-field-wide">
                <input
                  type="checkbox"
                  checked={editor.isVisible}
                  onChange={(event) => setEditor({ ...editor, isVisible: event.target.checked })}
                />
                <span aria-hidden="true" />
                <div>
                  <strong>Widoczny w sklepie</strong>
                  <small>Wyłącz, aby ukryć produkt bez jego usuwania.</small>
                </div>
              </label>
            </div>

            {(message || error) && (
              <p className={`admin-message ${error ? "is-error" : "is-success"}`} role="status">
                {error || message}
              </p>
            )}

            <div className="admin-form-actions">
              <Link href="/">Anuluj i wróć do sklepu</Link>
              <button type="submit" disabled={saving}>
                {saving ? saveStage || "Zapisywanie…" : editor.id ? "Zapisz zmiany" : "Dodaj produkt"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </section>
  );
}
