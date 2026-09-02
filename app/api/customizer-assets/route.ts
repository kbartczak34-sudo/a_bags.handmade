import {
  isCustomizerProductId,
  listCustomizerAssets,
} from "../../../lib/customizer-assets";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const productId = new URL(request.url).searchParams.get("productId")?.trim() ?? "";
  if (!isCustomizerProductId(productId)) {
    return Response.json({ error: "Nieprawidłowy produkt." }, { status: 400 });
  }

  try {
    const assets = await listCustomizerAssets(productId);
    return Response.json({ assets }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Customizer asset manifest failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json({ error: "Nie udało się wczytać wariantów personalizacji." }, { status: 500 });
  }
}
