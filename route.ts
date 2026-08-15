import {
  getSiteContentBucket,
  getSiteImageRecord,
} from "../../../lib/site-content";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const record = await getSiteImageRecord();
    if (!record.key) return new Response("Brak zdjęcia.", { status: 404 });

    const object = await getSiteContentBucket().get(record.key);
    if (!object) return new Response("Brak zdjęcia.", { status: 404 });

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set(
      "Content-Type",
      record.contentType || headers.get("Content-Type") || "image/jpeg",
    );
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.set("ETag", object.httpEtag);
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(object.body, { headers });
  } catch (error) {
    console.error("Site image read failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return new Response("Nie udało się wczytać zdjęcia.", { status: 500 });
  }
}

