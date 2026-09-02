import {
  getCustomizerAssetRecord,
  getCustomizerBucket,
  isCustomizerCategory,
  isCustomizerProductId,
  isCustomizerVariant,
} from "../../../../../../lib/customizer-assets";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    productId: string;
    category: string;
    variant: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const params = await context.params;
  const productId = params.productId.trim();
  const category = params.category.trim();
  const variant = params.variant.replace(/\.(?:png|webp)$/i, "").trim();

  if (!isCustomizerProductId(productId) || !isCustomizerCategory(category) || !isCustomizerVariant(variant)) {
    return new Response("Nieprawidłowy wariant personalizacji.", { status: 400 });
  }

  try {
    const record = await getCustomizerAssetRecord(productId, category, variant);
    if (!record) return new Response("Brak wariantu.", { status: 404 });
    const object = await getCustomizerBucket().get(record.image_key);
    if (!object) return new Response("Brak wariantu.", { status: 404 });

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Content-Type", record.image_content_type || headers.get("Content-Type") || "image/png");
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.set("ETag", object.httpEtag);
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(object.body, { headers });
  } catch (error) {
    console.error("Dynamic customizer layer read failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return new Response("Nie udało się wczytać wariantu.", { status: 500 });
  }
}
