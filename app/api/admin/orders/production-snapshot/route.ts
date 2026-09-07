import { isAdminRequest } from "../../../../../lib/admin-auth";
import { getProductionSnapshot } from "../../../../../lib/production-snapshots";

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return json({ error: "Brak dostępu." }, 403);

  const snapshotId = new URL(request.url).searchParams.get("snapshotId")?.trim() ?? "";
  if (!/^ps_[0-9a-f-]{36}$/.test(snapshotId)) {
    return json({ error: "Nieprawidłowy identyfikator Production Snapshot." }, 400);
  }

  try {
    const snapshot = await getProductionSnapshot(snapshotId);
    if (!snapshot) {
      return json({ error: "Production Snapshot nie istnieje.", code: "PRODUCTION_SNAPSHOT_NOT_FOUND" }, 404);
    }
    return json({ snapshot });
  } catch (error) {
    console.error("Admin production snapshot read failed", {
      snapshotId,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return json({ error: "Nie udało się wczytać Production Snapshot." }, 503);
  }
}
