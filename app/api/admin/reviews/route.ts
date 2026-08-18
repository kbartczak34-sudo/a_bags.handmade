import { isAdminRequest } from "../../../../lib/admin-auth";
import {
  deleteReview,
  listAdminReviews,
  setReviewStatus,
  type ReviewStatus,
} from "../../../../lib/reviews";

export const dynamic = "force-dynamic";

const reviewStatuses = new Set<ReviewStatus>([
  "pending",
  "approved",
  "rejected",
]);

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function unauthorized() {
  return json({ error: "Brak dostępu do opinii." }, 403);
}

function validId(value: unknown) {
  const id = String(value ?? "").trim();
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  try {
    return json({ reviews: await listAdminReviews() });
  } catch (error) {
    console.error("Admin review list failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return json({ error: "Nie udało się wczytać opinii." }, 500);
  }
}

export async function PATCH(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Nieprawidłowa zmiana opinii." }, 400);
  }
  if (!body || typeof body !== "object") {
    return json({ error: "Nieprawidłowa zmiana opinii." }, 400);
  }

  const payload = body as Record<string, unknown>;
  const id = validId(payload.id);
  const status = String(payload.status ?? "") as ReviewStatus;
  if (!id || !reviewStatuses.has(status)) {
    return json({ error: "Nieprawidłowa opinia lub status." }, 400);
  }

  try {
    if (!(await setReviewStatus(id, status))) {
      return json({ error: "Opinia nie istnieje." }, 404);
    }
    return json({ reviews: await listAdminReviews() });
  } catch (error) {
    console.error("Admin review status update failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return json({ error: "Nie udało się zmienić opinii." }, 500);
  }
}

export async function DELETE(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  const id = validId(new URL(request.url).searchParams.get("id"));
  if (!id) return json({ error: "Nieprawidłowa opinia." }, 400);

  try {
    if (!(await deleteReview(id))) {
      return json({ error: "Opinia nie istnieje." }, 404);
    }
    return json({ reviews: await listAdminReviews() });
  } catch (error) {
    console.error("Admin review delete failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return json({ error: "Nie udało się usunąć opinii." }, 500);
  }
}
