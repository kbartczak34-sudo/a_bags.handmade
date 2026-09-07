import { isAdminRequest } from "../../../../lib/admin-auth";
import {
  getCraftBuilderAccessoryBindings,
  upsertCraftBuilderAccessoryBinding,
} from "../../../../lib/craft-builder-accessory-bindings";
import { getCraftAccessorySnapshot } from "../../../../lib/craft-accessories";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return json({ error: "Brak dostępu do bindingów akcesoriów." }, 403);
  try {
    const [bindings, accessorySnapshot] = await Promise.all([
      getCraftBuilderAccessoryBindings(),
      getCraftAccessorySnapshot(),
    ]);
    return json({ bindings, accessorySnapshot });
  } catch (error) {
    console.error("Craft builder accessory bindings load failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return json({ error: "Nie udało się wczytać bindingów akcesoriów." }, 500);
  }
}

export async function PUT(request: Request) {
  if (!isAdminRequest(request)) return json({ error: "Brak dostępu do bindingów akcesoriów." }, 403);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Nieprawidłowe dane bindingu." }, 400);
  }

  try {
    return json({ binding: await upsertCraftBuilderAccessoryBinding(body) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nie udało się zapisać bindingu.";
    console.error("Craft builder accessory binding save failed", { message });
    return json({ error: message }, 400);
  }
}
