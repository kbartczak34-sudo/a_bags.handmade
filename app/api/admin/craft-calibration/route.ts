import { isAdminRequest } from "../../../../lib/admin-auth";
import {
  createCordMaterial,
  createGaugeProfile,
  createGoldenMaster,
  getCraftCalibrationSnapshot,
} from "../../../../lib/craft-calibration";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return json({ error: "Brak dostępu do laboratorium rzemiosła." }, 403);
  try {
    return json({ calibration: await getCraftCalibrationSnapshot() });
  } catch (error) {
    console.error("Craft calibration load failed", { message: error instanceof Error ? error.message : "Unknown error" });
    return json({ error: "Nie udało się wczytać danych kalibracyjnych." }, 500);
  }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return json({ error: "Brak dostępu do laboratorium rzemiosła." }, 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Nieprawidłowe dane kalibracyjne." }, 400);
  }

  const raw = typeof body === "object" && body ? body as Record<string, unknown> : {};
  try {
    if (raw.kind === "cord") return json({ record: await createCordMaterial(raw.data) }, 201);
    if (raw.kind === "gauge") return json({ record: await createGaugeProfile(raw.data) }, 201);
    if (raw.kind === "golden-master") return json({ record: await createGoldenMaster(raw.data) }, 201);
    return json({ error: "Nieobsługiwany typ kalibracji." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nie udało się zapisać kalibracji.";
    console.error("Craft calibration save failed", { message, kind: raw.kind });
    return json({ error: message }, 400);
  }
}
