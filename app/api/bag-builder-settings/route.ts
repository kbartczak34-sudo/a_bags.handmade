import { getBagBuilderSettings } from "../../../lib/bag-builder-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getBagBuilderSettings();
    return Response.json({ settings }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Bag Builder settings load failed", { message: error instanceof Error ? error.message : "Unknown error" });
    return Response.json({ error: "Nie udało się wczytać ustawień konfiguratora." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
