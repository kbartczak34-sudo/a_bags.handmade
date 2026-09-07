import { isAdminRequest } from "../../../../lib/admin-auth";
import { getCraftAccessorySnapshot } from "../../../../lib/craft-accessories";
import {
  getCraftAccessoryBomUsage,
  upsertCraftAccessoryBomUsage,
} from "../../../../lib/craft-builder-accessory-bom-usage";
import { getCraftBuilderAccessoryBindings } from "../../../../lib/craft-builder-accessory-bindings";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return json({ error: "Brak dostępu do zużycia BOM akcesoriów." }, 403);
  try {
    const [usage, bindings, accessorySnapshot] = await Promise.all([
      getCraftAccessoryBomUsage(),
      getCraftBuilderAccessoryBindings(),
      getCraftAccessorySnapshot(),
    ]);
    return json({ usage, bindings, accessorySnapshot });
  } catch (error) {
    console.error("Craft accessory BOM usage load failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return json({ error: "Nie udało się wczytać zużycia BOM akcesoriów." }, 500);
  }
}

export async function PUT(request: Request) {
  if (!isAdminRequest(request)) return json({ error: "Brak dostępu do zużycia BOM akcesoriów." }, 403);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Nieprawidłowe dane zużycia BOM." }, 400);
  }

  try {
    return json({ usage: await upsertCraftAccessoryBomUsage(body) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nie udało się zapisać zużycia BOM.";
    console.error("Craft accessory BOM usage save failed", { message });
    return json({ error: message }, 400);
  }
}
