import { isAdminRequest } from "../../../../lib/admin-auth";
import { listAdminOrders } from "../../../../lib/orders";

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return json({ error: "Brak dostępu." }, 403);
  }

  try {
    const orders = await listAdminOrders();
    return json({ orders });
  } catch (error) {
    console.error("Admin orders read failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return json({ error: "Nie udało się wczytać zamówień." }, 503);
  }
}
