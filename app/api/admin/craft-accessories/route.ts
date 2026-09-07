import { isAdminRequest } from "../../../../lib/admin-auth";
import {
  createCraftAccessory,
  createCraftMountingProfile,
  getCraftAccessorySnapshot,
} from "../../../../lib/craft-accessories";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return json({ error: "Brak dostępu do laboratorium akcesoriów." }, 403);
  try {
    return json({ accessories: await getCraftAccessorySnapshot() });
  } catch (error) {
    console.error("Craft accessories load failed", { message: error instanceof Error ? error.message : "Unknown error" });
    return json({ error: "Nie udało się wczytać fizycznych profili akcesoriów." }, 500);
  }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return json({ error: "Brak dostępu do laboratorium akcesoriów." }, 403);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Nieprawidłowe dane profilu akcesorium." }, 400);
  }

  const raw = typeof body === "object" && body ? body as Record<string, unknown> : {};
  try {
    if (raw.kind === "accessory") return json({ record: await createCraftAccessory(raw.data) }, 201);
    if (raw.kind === "mounting") return json({ record: await createCraftMountingProfile(raw.data) }, 201);
    return json({ error: "Nieobsługiwany typ danych akcesorium." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nie udało się zapisać profilu akcesorium.";
    console.error("Craft accessory save failed", { message, kind: raw.kind });
    return json({ error: message }, 400);
  }
}
