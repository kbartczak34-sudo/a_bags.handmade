import { isAdminRequest } from "../../../../lib/admin-auth";
import {
  getSiteContentBucket,
  getSiteContentPayload,
  saveSiteContent,
} from "../../../../lib/site-content";

export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_CONTENT_BYTES = 60 * 1024;

type DetectedImage = {
  contentType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function unauthorized() {
  return json({ error: "Brak dostępu do panelu." }, 403);
}

function detectImage(bytes: Uint8Array): DetectedImage | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (
    bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 &&
    bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d &&
    bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return { contentType: "image/png", extension: "png" };
  }
  if (
    bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return { contentType: "image/webp", extension: "webp" };
  }
  return null;
}

async function storeHeroImage(file: File) {
  if (file.size < 12) throw new Error("Wybrane zdjęcie jest puste lub uszkodzone.");
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Zdjęcie jest zbyt duże. Wybierz je ponownie, aby panel mógł je automatycznie zmniejszyć.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectImage(bytes);
  if (!detected) throw new Error("Format wybranego zdjęcia jest nieprawidłowy. Użyj JPG, PNG lub WEBP.");

  const key = `site/hero/${crypto.randomUUID()}.${detected.extension}`;
  await getSiteContentBucket().put(key, bytes, {
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
    return json(await getSiteContentPayload());
  } catch (error) {
    console.error("Admin site content read failed", { message: error instanceof Error ? error.message : "Unknown error" });
    return json({ error: "Nie udało się wczytać ustawień strony." }, 500);
  }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json({ error: "Nieprawidłowy formularz ustawień." }, 400);
  }

  const rawContent = String(formData.get("content") ?? "");
  if (!rawContent || new TextEncoder().encode(rawContent).length > MAX_CONTENT_BYTES) {
    return json({ error: "Treść formularza jest zbyt duża lub niepełna." }, 400);
  }

  let content: unknown;
  try {
    content = JSON.parse(rawContent);
  } catch {
    return json({ error: "Nie udało się odczytać treści formularza." }, 400);
  }

  const fileValue = formData.get("heroImage");
  const imageFile = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
  const removeHeroImage = String(formData.get("removeHeroImage") ?? "") === "true";
  let newImage: { key: string; contentType: string } | null | undefined;

  try {
    if (imageFile) newImage = await storeHeroImage(imageFile);
    else if (removeHeroImage) newImage = null;

    const saved = await saveSiteContent(content, newImage);
    if (saved.oldHeroImageKey && newImage !== undefined && saved.oldHeroImageKey !== newImage?.key) {
      try {
        await getSiteContentBucket().delete(saved.oldHeroImageKey);
      } catch (cleanupError) {
        console.warn("old site image cleanup failed", { message: cleanupError instanceof Error ? cleanupError.message : "Unknown error" });
      }
    }
    return json({ ...saved.payload, message: "Zmiany na stronie zostały zapisane." });
  } catch (error) {
    if (newImage?.key) {
      try { await getSiteContentBucket().delete(newImage.key); } catch { /* best effort */ }
    }
    const validationError = error instanceof Error &&
      (error.message.startsWith("Zdjęcie") || error.message.startsWith("Format") || error.message.startsWith("Wybrane"));
    console.error("Admin site content save failed", { message: error instanceof Error ? error.message : "Unknown error" });
    return json(
      { error: validationError ? (error as Error).message : "Nie udało się zapisać zmian na stronie." },
      validationError ? 400 : 500,
    );
  }
}
