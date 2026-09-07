import { isAdminRequest } from "../../../../lib/admin-auth";
import {
  createCraftProductionRecipe,
  getCraftProductionRecipes,
} from "../../../../lib/craft-production-recipes";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return json({ error: "Brak dostępu do receptur produkcyjnych." }, 403);
  try {
    return json({ recipes: await getCraftProductionRecipes() });
  } catch (error) {
    console.error("Craft production recipes load failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return json({ error: "Nie udało się wczytać receptur produkcyjnych." }, 500);
  }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return json({ error: "Brak dostępu do receptur produkcyjnych." }, 403);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Nieprawidłowe dane receptury." }, 400);
  }

  try {
    return json({ recipe: await createCraftProductionRecipe(body) }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nie udało się zapisać receptury.";
    console.error("Craft production recipe save failed", { message });
    return json({ error: message }, 400);
  }
}
