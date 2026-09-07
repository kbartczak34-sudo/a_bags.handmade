import { isAdminRequest } from "../../../../../lib/admin-auth";
import { getOrderConfigurationSnapshot } from "../../../../../lib/order-configuration-snapshots";

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return json({ error: "Brak dostępu." }, 403);

  const sessionId = new URL(request.url).searchParams.get("session_id")?.trim() ?? "";
  if (!/^cs_(test_|live_)?[A-Za-z0-9_]+$/.test(sessionId)) {
    return json({ error: "Nieprawidłowy identyfikator zamówienia." }, 400);
  }

  try {
    const snapshot = await getOrderConfigurationSnapshot(sessionId);
    if (!snapshot) return json({ error: "To zamówienie nie ma snapshotu konfiguratora." }, 404);
    return json({ snapshot });
  } catch (error) {
    console.error("Admin configured order snapshot read failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return json({ error: "Nie udało się wczytać konfiguracji zamówienia." }, 503);
  }
}
