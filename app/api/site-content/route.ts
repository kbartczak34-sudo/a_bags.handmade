import { getSiteContentPayload } from "../../../lib/site-content";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getSiteContentPayload(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Site content read failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json(
      { error: "Nie udało się wczytać treści strony." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
