import {
  createPendingReview,
  listApprovedReviews,
} from "../../../lib/reviews";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  try {
    return json({ reviews: await listApprovedReviews() });
  } catch (error) {
    console.error("Review list failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return json({ error: "Nie udało się wczytać opinii." }, 500);
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Nieprawidłowy formularz opinii." }, 400);
  }

  if (!body || typeof body !== "object") {
    return json({ error: "Nieprawidłowy formularz opinii." }, 400);
  }

  const payload = body as Record<string, unknown>;
  const authorName = String(payload.authorName ?? "").trim();
  const content = String(payload.content ?? "").trim();
  const website = String(payload.website ?? "").trim();

  if (website) return json({ ok: true, message: "Dziękujemy za opinię." }, 201);
  if (authorName.length < 2 || authorName.length > 60) {
    return json({ error: "Podaj imię lub inicjały (od 2 do 60 znaków)." }, 400);
  }
  if (content.length < 20 || content.length > 600) {
    return json({ error: "Opinia powinna mieć od 20 do 600 znaków." }, 400);
  }

  try {
    await createPendingReview(authorName, content);
    return json({ ok: true, message: "Dziękujemy! Opinia pojawi się po akceptacji." }, 201);
  } catch (error) {
    console.error("Review submission failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return json({ error: "Nie udało się wysłać opinii. Spróbuj ponownie." }, 500);
  }
}
