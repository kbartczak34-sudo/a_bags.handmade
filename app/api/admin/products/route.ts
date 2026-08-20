import { isAdminRequest } from "../../../../lib/admin-auth";
import {
  createProduct,
  deleteProduct,
  getProductBucket,
  listAdminProducts,
  type ProductInput,
  updateProduct,
} from "../../../../lib/products";

export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

type DetectedImage = {
  contentType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
};

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function unauthorized() {
  return json({ error: "Brak dostępu do panelu." }, 403);
}

function parsePriceToCents(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d{1,6}(?:\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  return cents >= 1 && cents <= 100_000_000 ? cents : null;
}

function parseProductInput(formData: FormData): ProductInput | null {
  const name = String(formData.get("name") ?? "").trim();
  const detail = String(formData.get("detail") ?? "").trim();
  const priceCents = parsePriceToCents(String(formData.get("price") ?? ""));
  const sortOrder = Number.parseInt(String(formData.get("sortOrder") ?? "0"), 10);
  const isVisible = String(formData.get("isVisible") ?? "") === "true";

  if (!name || name.length > 80) return null;
  if (detail.length > 180) return null;
  if (priceCents === null) return null;
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999) return null;
  return { name, detail, priceCents, sortOrder, isVisible };
}

function detectImage(bytes: Uint8Array): DetectedImage | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { contentType: "image/png", extension: "png" };
  }

  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return { contentType: "image/webp", extension: "webp" };
  }

  return null;
}

async function storeImage(file: File, productId: string) {
  if (file.size < 12) {
    throw new Error("Wybrane zdjęcie jest puste lub uszkodzone.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(
      "Zdjęcie jest zbyt duże. Wybierz je ponownie, aby panel mógł je automatycznie zmniejszyć.",
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectImage(bytes);
  if (!detected) {
    throw new Error("Format wybranego zdjęcia jest nieprawidłowy. Użyj JPG, PNG lub WEBP.");
  }

  // Nie ufamy wyłącznie file.type: mobilne przeglądarki i multipart potrafią
  // przesłać poprawny obraz z pustym lub błędnym MIME. Format ustalamy z bajtów.
  const key = `products/${productId}/${crypto.randomUUID()}.${detected.extension}`;
  await getProductBucket().put(key, bytes, {
    httpMetadata: {
      contentType: detected.contentType,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });
  return { key, contentType: detected.contentType };
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  try {
    return json({ products: await listAdminProducts() });
  } catch (error) {
    console.error("Admin product list failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return json({ error: "Nie udało się wczytać produktów." }, 500);
  }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json({ error: "Nieprawidłowy formularz produktu." }, 400);
  }

  const input = parseProductInput(formData);
  if (!input) {
    return json({ error: "Sprawdź nazwę, cenę, opis i kolejność produktu." }, 400);
  }

  const id = String(formData.get("id") ?? "").trim();
  if (id && (id.length > 80 || !/^[a-zA-Z0-9-]+$/.test(id))) {
    return json({ error: "Nieprawidłowy identyfikator produktu." }, 400);
  }

  const fileValue = formData.get("image");
  const imageFile = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
  const removeImage = String(formData.get("removeImage") ?? "") === "true";
  let newImage: { key: string; contentType: string } | null | undefined;

  try {
    const targetId = id || crypto.randomUUID();
    if (imageFile) {
      newImage = await storeImage(imageFile, targetId);
    } else if (removeImage) {
      newImage = null;
    }

    if (!id) {
      const createdId = await createProduct(input, newImage ?? null, targetId);
      return json({ id: createdId, products: await listAdminProducts() }, 201);
    }

    const result = await updateProduct(id, input, newImage);
    if (!result.updated) {
      if (newImage?.key) await getProductBucket().delete(newImage.key);
      return json({ error: "Produkt nie istnieje." }, 404);
    }

    if (
      result.oldImageKey &&
      newImage !== undefined &&
      result.oldImageKey !== newImage?.key
    ) {
      try {
        await getProductBucket().delete(result.oldImageKey);
      } catch (cleanupError) {
        console.warn("Old product image cleanup failed", {
          message:
            cleanupError instanceof Error ? cleanupError.message : "Unknown error",
        });
      }
    }
    return json({ products: await listAdminProducts() });
  } catch (error) {
    if (newImage?.key) {
      try {
        await getProductBucket().delete(newImage.key);
      } catch {
        // Best-effort cleanup after a failed database write.
      }
    }
    const isImageValidationError =
      error instanceof Error &&
      (error.message.startsWith("Zdjęcie") ||
        error.message.startsWith("Wybrane zdjęcie") ||
        error.message.startsWith("Format"));
    const message = isImageValidationError
      ? error.message
      : "Nie udało się zapisać produktu.";
    console.error("Admin product save failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return json({ error: message }, isImageValidationError ? 400 : 500);
  }
}

export async function DELETE(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!id || id.length > 80 || !/^[a-zA-Z0-9-]+$/.test(id)) {
    return json({ error: "Nieprawidłowy produkt." }, 400);
  }

  try {
    const result = await deleteProduct(id);
    if (!result.deleted) return json({ error: "Produkt nie istnieje." }, 404);
    if (result.imageKey) {
      try {
        await getProductBucket().delete(result.imageKey);
      } catch (cleanupError) {
        console.warn("Deleted product image cleanup failed", {
          message:
            cleanupError instanceof Error ? cleanupError.message : "Unknown error",
        });
      }
    }
    return json({ products: await listAdminProducts() });
  } catch (error) {
    console.error("Admin product delete failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return json({ error: "Nie udało się usunąć produktu." }, 500);
  }
}
