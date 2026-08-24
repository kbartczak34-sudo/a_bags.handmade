import { isAdminRequest } from "../../../../lib/admin-auth";
import {
  listAdminProducts,
  type ProductComplianceInput,
  updateProductCompliance,
} from "../../../../lib/products";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function clean(value: unknown, maxLength: number) {
  const text = String(value ?? "").trim();
  return text.length <= maxLength ? text : null;
}

export async function PATCH(request: Request) {
  if (!isAdminRequest(request)) {
    return json({ error: "Brak dostępu do danych zgodności produktu." }, 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Nieprawidłowe dane produktu." }, 400);
  }

  if (!body || typeof body !== "object") {
    return json({ error: "Nieprawidłowe dane produktu." }, 400);
  }

  const payload = body as Record<string, unknown>;
  const id = String(payload.id ?? "").trim();
  if (!id || id.length > 80 || !/^[a-zA-Z0-9-]+$/.test(id)) {
    return json({ error: "Nieprawidłowy produkt." }, 400);
  }

  const productIdentifier = clean(payload.productIdentifier, 120);
  const batchCode = clean(payload.batchCode, 120);
  const materials = clean(payload.materials, 800);
  const careInstructions = clean(payload.careInstructions, 1200);
  const safetyInfo = clean(payload.safetyInfo, 1600);
  if (
    productIdentifier === null ||
    batchCode === null ||
    materials === null ||
    careInstructions === null ||
    safetyInfo === null
  ) {
    return json({ error: "Jedno z pól zgodności jest zbyt długie." }, 400);
  }

  const input: ProductComplianceInput = {
    productIdentifier,
    batchCode,
    materials,
    careInstructions,
    safetyInfo,
  };

  try {
    const updated = await updateProductCompliance(id, input);
    if (!updated) return json({ error: "Produkt nie istnieje." }, 404);
    return json({ products: await listAdminProducts() });
  } catch (error) {
    console.error("Product compliance update failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return json({ error: "Nie udało się zapisać danych zgodności produktu." }, 500);
  }
}
