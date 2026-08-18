import { listStorefrontProducts } from "../../../lib/products";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = await listStorefrontProducts();
    return Response.json(
      { products },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Product catalog read failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json(
      { error: "Nie udało się wczytać produktów." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
