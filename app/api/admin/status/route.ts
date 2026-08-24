import { isAdminRequest } from "../../../../lib/admin-auth";
import { getPublicLegalConfig } from "../../../../lib/legal-config";
import { getRuntimeBindings } from "../../../../lib/runtime-env";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function hasValue(value: string | undefined) {
  return Boolean((value ?? "").trim());
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return json({ error: "Brak dostępu do statusu sklepu." }, 403);
  }

  const env = getRuntimeBindings();
  const legal = getPublicLegalConfig();

  let databaseReady = false;
  if (env.DB) {
    try {
      const result = await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
      databaseReady = result?.ok === 1;
    } catch {
      databaseReady = false;
    }
  }

  const technical = {
    databaseReady,
    mediaReady: Boolean(env.BUCKET),
    stripeReady: hasValue(env.STRIPE_SECRET_KEY),
    webhookReady: hasValue(env.STRIPE_WEBHOOK_SECRET),
    emailReady: hasValue(env.RESEND_API_KEY) && hasValue(env.ORDER_EMAIL_FROM),
  };

  const technicalReady = Object.values(technical).every(Boolean);
  const launchReady = technicalReady && legal.launchReady;

  return json({
    checkedAt: new Date().toISOString(),
    launchReady,
    checkoutGate: launchReady ? "ready" : "blocked",
    technical,
    legal: {
      launchReady: legal.launchReady,
      businessMode: legal.businessMode,
      vatMode: legal.vatMode,
      transactionalEmailReady: legal.transactionalEmailReady,
      readinessIssues: legal.readinessIssues,
    },
  });
}
