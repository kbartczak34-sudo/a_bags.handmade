import { isAdminRequest } from "../../../../lib/admin-auth";
import { getPublicLegalConfig } from "../../../../lib/legal-config";
import { listAdminProducts } from "../../../../lib/products";
import { getRuntimeBindings } from "../../../../lib/runtime-env";
import {
  getStripeKeyMode,
  isStripeLiveWebhookConfirmed,
  isStripeLiveWebhookReady,
} from "../../../../lib/stripe";

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

function productComplianceComplete(product: Awaited<ReturnType<typeof listAdminProducts>>[number]) {
  return Boolean(
    product.productIdentifier.trim() &&
      product.materials.trim() &&
      product.careInstructions.trim() &&
      product.safetyInfo.trim(),
  );
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return json({ error: "Brak dostępu do statusu sklepu." }, 403);
  }

  const env = getRuntimeBindings();
  const legal = getPublicLegalConfig();
  const stripeMode = getStripeKeyMode();
  const liveWebhookConfirmed = isStripeLiveWebhookConfirmed();

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
    stripeReady: stripeMode === "live",
    webhookReady: isStripeLiveWebhookReady(),
    emailReady: hasValue(env.RESEND_API_KEY) && hasValue(env.ORDER_EMAIL_FROM),
  };

  let productCompliance = {
    ready: false,
    totalVisible: 0,
    completeVisible: 0,
    incomplete: [] as Array<{ id: string; name: string }>,
  };

  if (databaseReady) {
    try {
      const visibleProducts = (await listAdminProducts()).filter((product) => product.isVisible);
      const incomplete = visibleProducts
        .filter((product) => !productComplianceComplete(product))
        .map((product) => ({ id: product.id, name: product.name }));
      productCompliance = {
        ready: visibleProducts.length > 0 && incomplete.length === 0,
        totalVisible: visibleProducts.length,
        completeVisible: visibleProducts.length - incomplete.length,
        incomplete,
      };
    } catch {
      productCompliance = {
        ready: false,
        totalVisible: 0,
        completeVisible: 0,
        incomplete: [],
      };
    }
  }

  const technicalReady = Object.values(technical).every(Boolean);
  const launchReady = technicalReady && legal.launchReady && productCompliance.ready;

  return json({
    checkedAt: new Date().toISOString(),
    launchReady,
    checkoutGate: launchReady ? "ready" : "blocked",
    stripeMode,
    liveWebhookConfirmed,
    technical,
    productCompliance,
    legal: {
      launchReady: legal.launchReady,
      businessMode: legal.businessMode,
      vatMode: legal.vatMode,
      transactionalEmailReady: legal.transactionalEmailReady,
      readinessIssues: legal.readinessIssues,
    },
  });
}
