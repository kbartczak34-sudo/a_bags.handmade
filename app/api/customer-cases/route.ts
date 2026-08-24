import {
  consumeCustomerCaseSubmission,
  createCustomerCase,
  type CustomerCaseType,
} from "../../../lib/customer-cases";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200, extraHeaders?: HeadersInit) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clean(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function isCaseType(value: string): value is CustomerCaseType {
  return value === "withdrawal" || value === "complaint";
}

async function submissionFingerprint(request: Request) {
  const source =
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`a-bags-customer-case:${source}`),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Nieprawidłowe dane zgłoszenia." }, 400);
  }

  if (!isObject(body)) {
    return json({ error: "Nieprawidłowe dane zgłoszenia." }, 400);
  }

  const type = clean(body.type, 20);
  const customerName = clean(body.customerName, 100);
  const email = clean(body.email, 254).toLowerCase();
  const orderReference = clean(body.orderReference, 120);
  const productName = clean(body.productName, 120);
  const description = clean(body.description, 3000);
  const requestedResolution = clean(body.requestedResolution, 500);
  const website = clean(body.website, 240);

  if (website) {
    return json(
      {
        ok: true,
        message: "Zgłoszenie zostało przyjęte.",
      },
      201,
    );
  }

  if (!isCaseType(type)) {
    return json({ error: "Wybierz rodzaj zgłoszenia." }, 400);
  }
  if (customerName.length < 2) {
    return json({ error: "Podaj imię i nazwisko lub dane osoby zgłaszającej." }, 400);
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return json({ error: "Podaj prawidłowy adres e-mail." }, 400);
  }
  if (description.length < 20) {
    return json({ error: "Opis zgłoszenia powinien mieć co najmniej 20 znaków." }, 400);
  }
  if (type === "complaint" && requestedResolution.length < 2) {
    return json({ error: "Wskaż oczekiwane rozwiązanie reklamacji." }, 400);
  }

  try {
    const rate = await consumeCustomerCaseSubmission(
      await submissionFingerprint(request),
    );
    if (!rate.allowed) {
      return json(
        { error: "Wysłano zbyt wiele zgłoszeń. Spróbuj ponownie później." },
        429,
        {
          "Retry-After": String(rate.retryAfter),
          "X-RateLimit-Remaining": String(rate.remaining),
        },
      );
    }

    const created = await createCustomerCase({
      type,
      orderReference,
      customerName,
      email,
      productName,
      description,
      requestedResolution:
        type === "withdrawal"
          ? requestedResolution || "Odstąpienie od umowy"
          : requestedResolution,
    });

    return json(
      {
        ok: true,
        caseId: created.id,
        responseDueAt: created.responseDueAt,
        message:
          type === "complaint"
            ? "Reklamacja została przyjęta. Zachowaj numer sprawy."
            : "Oświadczenie o odstąpieniu zostało przyjęte. Zachowaj numer sprawy.",
      },
      201,
      { "X-RateLimit-Remaining": String(rate.remaining) },
    );
  } catch (error) {
    console.error("Customer case submission failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return json(
      { error: "Nie udało się zapisać zgłoszenia. Spróbuj ponownie." },
      500,
    );
  }
}
