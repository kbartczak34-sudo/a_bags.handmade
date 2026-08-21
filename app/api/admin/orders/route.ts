import { isAdminRequest } from "../../../../lib/admin-auth";
import {
  getOrderSettings,
  listAdminOrders,
  updateFulfillmentStatus,
  updateOrderSettings,
  updateShippingDetails,
  type FulfillmentStatus,
  type OrderSettings,
} from "../../../../lib/orders";

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return json({ error: "Brak dostępu." }, 403);
  try {
    const [orders, settings] = await Promise.all([
      listAdminOrders(),
      getOrderSettings(),
    ]);
    return json({ orders, settings });
  } catch (error) {
    console.error("Admin orders read failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return json({ error: "Nie udało się wczytać zamówień." }, 503);
  }
}

export async function PATCH(request: Request) {
  if (!isAdminRequest(request)) return json({ error: "Brak dostępu." }, 403);

  try {
    const body = (await request.json()) as {
      action?: "fulfillment" | "shipping" | "settings";
      sessionId?: string;
      status?: FulfillmentStatus;
      carrier?: string;
      trackingNumber?: string;
      shippedAt?: string | null;
      settings?: OrderSettings;
    };

    if (body.action === "settings") {
      if (!body.settings) return json({ error: "Brak ustawień odbioru." }, 400);
      const settings = await updateOrderSettings(body.settings);
      return json({ orders: await listAdminOrders(), settings });
    }

    if (!body.sessionId) return json({ error: "Brak danych zamówienia." }, 400);

    if (body.action === "shipping") {
      const orders = await updateShippingDetails(body.sessionId, {
        carrier: body.carrier,
        trackingNumber: body.trackingNumber,
        shippedAt: body.shippedAt,
      });
      return json({ orders, settings: await getOrderSettings() });
    }

    if (!body.status) return json({ error: "Brak statusu zamówienia." }, 400);
    const orders = await updateFulfillmentStatus(body.sessionId, body.status);
    return json({ orders, settings: await getOrderSettings() });
  } catch (error) {
    console.error("Admin order update failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nie udało się zmienić danych zamówienia.",
      },
      400,
    );
  }
}
