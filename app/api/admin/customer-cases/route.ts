import { isAdminRequest } from "../../../../lib/admin-auth";
import {
  listCustomerCases,
  updateCustomerCase,
  type CustomerCaseStatus,
} from "../../../../lib/customer-cases";

export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = new Set<CustomerCaseStatus>([
  "new",
  "in_review",
  "responded",
  "closed",
]);

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function unauthorized() {
  return json({ error: "Brak dostępu do spraw klientów." }, 403);
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  try {
    return json({ cases: await listCustomerCases() });
  } catch (error) {
    console.error("Admin customer case list failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return json({ error: "Nie udało się wczytać spraw klientów." }, 500);
  }
}

export async function PATCH(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Nieprawidłowe dane sprawy." }, 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "Nieprawidłowe dane sprawy." }, 400);
  }

  const payload = body as Record<string, unknown>;
  const id = String(payload.id ?? "").trim();
  const status = String(payload.status ?? "").trim() as CustomerCaseStatus;
  const responseNote = String(payload.responseNote ?? "").trim();

  if (!/^AB-[A-Z0-9-]{6,40}$/.test(id)) {
    return json({ error: "Nieprawidłowy numer sprawy." }, 400);
  }
  if (!ALLOWED_STATUSES.has(status)) {
    return json({ error: "Nieprawidłowy status sprawy." }, 400);
  }
  if (responseNote.length > 4000) {
    return json({ error: "Notatka jest zbyt długa." }, 400);
  }

  try {
    const updated = await updateCustomerCase(id, status, responseNote);
    if (!updated) return json({ error: "Sprawa nie istnieje." }, 404);
    return json({ cases: await listCustomerCases() });
  } catch (error) {
    console.error("Admin customer case update failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return json({ error: "Nie udało się zaktualizować sprawy." }, 500);
  }
}
