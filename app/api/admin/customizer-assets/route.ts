import { isAdminRequest } from "../../../../lib/admin-auth";
import {
  deleteCustomizerAsset,
  getCustomizerBucket,
  isCustomizerCategory,
  isCustomizerProductId,
  isCustomizerVariant,
  listCustomizerAssets,
  upsertCustomizerAsset,
} from "../../../../lib/customizer-assets";

export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

type DetectedImage = {
  contentType: "image/png" | "image/webp";
  extension: "png" | "webp";
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function unauthorized() {
  return json({ error: "Brak dostępu do panelu." }, 403);
}

function detectImage(bytes: Uint8Array): DetectedImage | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return { contentType: "image/png", extension: "png" };

  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) return { contentType: "image/webp", extension: "webp" };

  return null;
}

function parseIdentity(source: URLSearchParams | FormData) {
  const productId = String(source.get("productId") ?? "").trim();
  const category = String(source.get("category") ?? "").trim();
  const variant = String(source.get("variant") ?? "").trim();
  if (!isCustomizerProductId(productId) || !isCustomizerCategory(category) || !isCustomizerVariant(variant)) return null;
  return { productId, category, variant };
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  const productId = new URL(request.url).searchParams.get("productId")?.trim() ?? "";
  if (!isCustomizerProductId(productId)) return json({ error: "Nieprawidłowy produkt." }, 400);
  try {
    return json({ assets: await listCustomizerAssets(productId) });
  } catch (error) {
    console.error("Admin customizer asset list failed", { message: error instanceof Error ? error.message : "Unknown error" });
    return json({ error: "Nie udało się wczytać warstw konfiguratora." }, 500);
  }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json({ error: "Nieprawidłowy formularz warstwy." }, 400);
  }

  const identity = parseIdentity(formData);
  if (!identity) return json({ error: "Nieprawidłowy produkt, kategoria lub wariant." }, 400);
  const fileValue = formData.get("image");
  if (!(fileValue instanceof File) || fileValue.size < 12) return json({ error: "Wybierz plik PNG lub WEBP z przezroczystym tłem." }, 400);
  if (fileValue.size > MAX_IMAGE_BYTES) return json({ error: "Warstwa jest zbyt duża. Maksymalny rozmiar to 4 MB." }, 400);

  const bytes = new Uint8Array(await fileValue.arrayBuffer());
  const detected = detectImage(bytes);
  if (!detected) return json({ error: "Warstwa musi być plikiem PNG lub WEBP." }, 400);

  const key = `customizer/${identity.productId}/${identity.category}/${identity.variant}/${crypto.randomUUID()}.${detected.extension}`;
  try {
    await getCustomizerBucket().put(key, bytes, {
      httpMetadata: {
        contentType: detected.contentType,
        cacheControl: "public, max-age=31536000, immutable",
      },
    });
    const result = await upsertCustomizerAsset({
      ...identity,
      imageKey: key,
      imageContentType: detected.contentType,
    });
    if (result.previousImageKey && result.previousImageKey !== key) {
      try { await getCustomizerBucket().delete(result.previousImageKey); } catch { /* best effort */ }
    }
    return json({ assets: await listCustomizerAssets(identity.productId) }, 201);
  } catch (error) {
    try { await getCustomizerBucket().delete(key); } catch { /* best effort */ }
    console.error("Admin customizer asset upload failed", { message: error instanceof Error ? error.message : "Unknown error" });
    return json({ error: "Nie udało się zapisać warstwy konfiguratora." }, 500);
  }
}

export async function DELETE(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  const identity = parseIdentity(new URL(request.url).searchParams);
  if (!identity) return json({ error: "Nieprawidłowy produkt, kategoria lub wariant." }, 400);
  try {
    const result = await deleteCustomizerAsset(identity.productId, identity.category, identity.variant);
    if (!result.deleted) return json({ error: "Warstwa nie istnieje." }, 404);
    if (result.imageKey) {
      try { await getCustomizerBucket().delete(result.imageKey); } catch { /* best effort */ }
    }
    return json({ assets: await listCustomizerAssets(identity.productId) });
  } catch (error) {
    console.error("Admin customizer asset delete failed", { message: error instanceof Error ? error.message : "Unknown error" });
    return json({ error: "Nie udało się usunąć warstwy konfiguratora." }, 500);
  }
}
