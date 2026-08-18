import {
  getProductBucket,
  getProductImageRecord,
} from "../../../lib/products";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!id || id.length > 80) {
    return new Response("Nieprawidłowy produkt.", { status: 400 });
  }

  try {
    const record = await getProductImageRecord(id);
    if (!record?.image_key) return new Response("Brak zdjęcia.", { status: 404 });

    const object = await getProductBucket().get(record.image_key);
    if (!object) return new Response("Brak zdjęcia.", { status: 404 });

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Content-Type", record.image_content_type || headers.get("Content-Type") || "image/jpeg");
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.set("ETag", object.httpEtag);
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(object.body, { headers });
  } catch (error) {
    console.error("Product image read failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return new Response("Nie udało się wczytać zdjęcia.", { status: 500 });
  }
}
