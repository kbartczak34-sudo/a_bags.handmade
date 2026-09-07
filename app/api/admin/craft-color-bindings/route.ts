import { isAdminRequest } from "../../../../lib/admin-auth";
import {
  getCraftCordColorBindings,
  saveCraftCordColorBinding,
} from "../../../../lib/craft-color-bindings";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return json({ error: "Brak dostępu do mapowania kolorów." }, 403);
  try {
    return json({ bindings: await getCraftCordColorBindings() });
  } catch (error) {
    console.error("Craft color bindings load failed", { message: error instanceof Error ? error.message : "Unknown error" });
    return json({ error: "Nie udało się wczytać mapowania kolorów." }, 500);
  }
}

export async function PUT(request: Request) {
  if (!isAdminRequest(request)) return json({ error: "Brak dostępu do mapowania kolorów." }, 403);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Nieprawidłowe dane mapowania koloru." }, 400);
  }
  try {
    return json({ binding: await saveCraftCordColorBinding(body) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nie udało się zapisać mapowania koloru.";
    console.error("Craft color binding save failed", { message });
    return json({ error: message }, 400);
  }
}
