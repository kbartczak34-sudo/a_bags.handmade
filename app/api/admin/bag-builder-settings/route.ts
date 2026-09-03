import { isAdminRequest } from "../../../../lib/admin-auth";
import { getBagBuilderSettings, saveBagBuilderSettings } from "../../../../lib/bag-builder-settings";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return json({ error: "Brak dostępu do panelu." }, 403);
  try {
    return json({ settings: await getBagBuilderSettings() });
  } catch (error) {
    console.error("Admin Bag Builder settings load failed", { message: error instanceof Error ? error.message : "Unknown error" });
    return json({ error: "Nie udało się wczytać ustawień Bag Buildera." }, 500);
  }
}

export async function PUT(request: Request) {
  if (!isAdminRequest(request)) return json({ error: "Brak dostępu do panelu." }, 403);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Nieprawidłowe dane ustawień." }, 400);
  }
  try {
    return json({ settings: await saveBagBuilderSettings(body) });
  } catch (error) {
    console.error("Admin Bag Builder settings save failed", { message: error instanceof Error ? error.message : "Unknown error" });
    return json({ error: "Nie udało się zapisać ustawień Bag Buildera." }, 500);
  }
}
