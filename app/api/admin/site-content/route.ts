import { isAdminRequest } from "../../../../lib/admin-auth";
import {
  getSiteContentBucket,
  getSiteContentPayload,
  saveSiteContent,
} from "../../../../lib/site-content";

export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_CONTENT_BYTES = 60 * 1024;
const IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function unauthorized() {
  return json({ error: "Brak dostępu do panelu." }, 403);
}

function hasFileSignature(bytes: Uint8Array, contentType: string) {
  if (contentType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/png") {
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    );
  }
  if (contentType === "image/webp") {
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  }
  return false;
}

async function storeHeroImage(file: File) {
  const extension = IMAGE_TYPES.get(file.type);
  if (!extension || file.size < 12 || file.size > MAX_IMAGE_BYTES) {
    throw new Error(
      "Zdjęcie jest zbyt duże. Wybierz je ponownie, aby panel mógł je automatycznie zmniejszyć.",
    );
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasFileSignature(bytes, file.type)) {
    throw new Error("Format wybranego zdjęcia jest nieprawidłowy.");
  }

  const key = `site/hero/${crypto.randomUUID()}.${extension}`;
  await getSiteContentBucket().put(key, bytes, {
    httpMetadata: {
      contentType: file.type,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });
  return { key, contentType: file.type };
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  try {
    return json(await getSiteContentPayload());
  } catch (error) {
    console.error("Admin site content read failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
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
    if (
      saved.oldHeroImageKey &&
      newImage !== undefined &&
      saved.oldHeroImageKey !== newImage?.key
    ) {
      try {
        await getSiteContentBucket().delete(saved.oldHeroImageKey);
      } catch (cleanupError) {
        console.warn("old site image cleanup failed", {
          message: cleanupError instanceof Error ? cleanupError.message : "Unknown error",
        });
      }
    }
    return json({ ...saved.payload, message: "Zmiany na stronie zostały zapisane." });
  } catch (error) {
    if (newImage?.key) {
      try {
        await getSiteContentBucket().delete(newImage.key);
      } catch {
        // Best-effort cleanup after a failed settings write.
      }
    }
    const validationError =
      error instanceof Error &&
      (error.message.startsWith("Zdjęcie") || error.message.startsWith("Format"));
    console.error("Admin site content save failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return json(
      {
        error: validationError
          ? (error as Error).message
          : "Nie udało się zapisać zmian na stronie.",
      },
      validationError ? 400 : 500,
    );
  }
}

