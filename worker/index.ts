/** Cloudflare Worker entry point for A-Bags Handmade. */
import {
  handleImageOptimization,
  DEFAULT_DEVICE_SIZES,
  DEFAULT_IMAGE_SIZES,
} from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { getPublicLegalConfig } from "../lib/legal-config";
import { setRuntimeBindings } from "../lib/runtime-env";

interface Env {
  ASSETS: Fetcher;
  ABAGSDB26081901: D1Database;
  ABAGSMEDIA26081901: R2Bucket;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  RESEND_API_KEY?: string;
  ORDER_EMAIL_FROM?: string;

  LEGAL_BUSINESS_MODE?: string;
  LEGAL_SELLER_NAME?: string;
  LEGAL_SELLER_ADDRESS?: string;
  LEGAL_SELLER_EMAIL?: string;
  LEGAL_SELLER_PHONE?: string;
  LEGAL_SELLER_NIP?: string;
  LEGAL_SELLER_REGON?: string;
  LEGAL_RETURNS_ADDRESS?: string;
  LEGAL_VAT_MODE?: string;
  LEGAL_MANUFACTURER_NAME?: string;
  LEGAL_MANUFACTURER_ADDRESS?: string;
  LEGAL_MANUFACTURER_EMAIL?: string;
  LEGAL_PRODUCT_COMPLIANCE_CONFIRMED?: string;
  LEGAL_PACKAGING_COMPLIANCE_CONFIRMED?: string;
  LEGAL_FISCAL_COMPLIANCE_CONFIRMED?: string;
  LEGAL_PRIVACY_COMPLIANCE_CONFIRMED?: string;

  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: {
          format: string;
          quality: number;
        }): Promise<{ response(): Response }>;
      };
    };
  };
}

type AccessIdentity = {
  email?: string;
  name?: string;
};

type AccessContext = {
  getIdentity(): Promise<AccessIdentity | null>;
};

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
  access?: AccessContext;
}

function isOwnerProtectedPath(pathname: string): boolean {
  return (
    pathname === "/site-admin" ||
    pathname.startsWith("/site-admin/") ||
    pathname === "/api/admin" ||
    pathname.startsWith("/api/admin/")
  );
}

function hasExternalContentConsent(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  return /(?:^|;\s*)abags-external-content=accepted(?:;|$)/.test(cookie);
}

function withBrowserPrivacyHeaders(request: Request, response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("text/html")) return response;

  const externalContentAllowed = hasExternalContentConsent(request);
  const instagramScriptSources = externalContentAllowed
    ? " https://www.instagram.com https://*.instagram.com https://*.cdninstagram.com"
    : "";
  const frameSources = externalContentAllowed
    ? "'self' https://www.instagram.com https://*.instagram.com"
    : "'self'";

  const headers = new Headers(response.headers);
  headers.set(
    "Content-Security-Policy",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval'${instagramScriptSources}; object-src 'none'; base-uri 'self'; frame-src ${frameSources}; frame-ancestors 'self'`,
  );
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(self)",
  );

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function getVerifiedAccessIdentity(
  request: Request,
  ctx: ExecutionContext,
): Promise<AccessIdentity | null> {
  if (ctx.access) {
    const identity = await ctx.access.getIdentity();
    if (identity?.email) return identity;
  }

  const cookie = request.headers.get("cookie");
  if (!cookie) return null;

  const url = new URL(request.url);
  const identityUrl = new URL("/cdn-cgi/access/get-identity", url.origin);

  try {
    const response = await fetch(identityUrl.toString(), {
      method: "GET",
      headers: {
        cookie,
        accept: "application/json",
      },
      redirect: "manual",
    });

    if (!response.ok) return null;

    const identity = (await response.json()) as AccessIdentity;
    return identity?.email ? identity : null;
  } catch {
    return null;
  }
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    setRuntimeBindings({
      DB: env.ABAGSDB26081901,
      BUCKET: env.ABAGSMEDIA26081901,
      STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: env.STRIPE_WEBHOOK_SECRET,
      RESEND_API_KEY: env.RESEND_API_KEY,
      ORDER_EMAIL_FROM: env.ORDER_EMAIL_FROM,
      LEGAL_BUSINESS_MODE: env.LEGAL_BUSINESS_MODE,
      LEGAL_SELLER_NAME: env.LEGAL_SELLER_NAME,
      LEGAL_SELLER_ADDRESS: env.LEGAL_SELLER_ADDRESS,
      LEGAL_SELLER_EMAIL: env.LEGAL_SELLER_EMAIL,
      LEGAL_SELLER_PHONE: env.LEGAL_SELLER_PHONE,
      LEGAL_SELLER_NIP: env.LEGAL_SELLER_NIP,
      LEGAL_SELLER_REGON: env.LEGAL_SELLER_REGON,
      LEGAL_RETURNS_ADDRESS: env.LEGAL_RETURNS_ADDRESS,
      LEGAL_VAT_MODE: env.LEGAL_VAT_MODE,
      LEGAL_MANUFACTURER_NAME: env.LEGAL_MANUFACTURER_NAME,
      LEGAL_MANUFACTURER_ADDRESS: env.LEGAL_MANUFACTURER_ADDRESS,
      LEGAL_MANUFACTURER_EMAIL: env.LEGAL_MANUFACTURER_EMAIL,
      LEGAL_PRODUCT_COMPLIANCE_CONFIRMED:
        env.LEGAL_PRODUCT_COMPLIANCE_CONFIRMED,
      LEGAL_PACKAGING_COMPLIANCE_CONFIRMED:
        env.LEGAL_PACKAGING_COMPLIANCE_CONFIRMED,
      LEGAL_FISCAL_COMPLIANCE_CONFIRMED:
        env.LEGAL_FISCAL_COMPLIANCE_CONFIRMED,
      LEGAL_PRIVACY_COMPLIANCE_CONFIRMED:
        env.LEGAL_PRIVACY_COMPLIANCE_CONFIRMED,
    });

    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(
        request,
        {
          fetchAsset: (path) =>
            env.ASSETS.fetch(new Request(new URL(path, request.url))),
          transformImage: async (body, { width, format, quality }) => {
            const result = await env.IMAGES.input(body)
              .transform(width > 0 ? { width } : {})
              .output({ format, quality });
            return result.response();
          },
        },
        allowedWidths,
      );
    }

    if (url.pathname === "/api/checkout" && request.method === "POST") {
      const { readinessIssues } = getPublicLegalConfig();
      if (readinessIssues.length > 0) {
        return Response.json(
          {
            error:
              "Sprzedaż jest wstrzymana do czasu uzupełnienia wymaganych danych i potwierdzeń prawnych sklepu. [legal_configuration_incomplete]",
            code: "legal_configuration_incomplete",
          },
          {
            status: 503,
            headers: { "cache-control": "no-store" },
          },
        );
      }
    }

    if (isOwnerProtectedPath(url.pathname)) {
      const identity = await getVerifiedAccessIdentity(request, ctx);
      const email = identity?.email?.trim().toLowerCase();

      if (!email) {
        return new Response("Cloudflare Access authentication required.", {
          status: 403,
          headers: { "cache-control": "no-store" },
        });
      }

      const headers = new Headers(request.headers);
      headers.set("cf-access-authenticated-user-email", email);
      headers.set("oai-authenticated-user-email", email);

      if (identity?.name) {
        headers.set(
          "oai-authenticated-user-full-name",
          encodeURIComponent(identity.name),
        );
        headers.set(
          "oai-authenticated-user-full-name-encoding",
          "percent-encoded-utf-8",
        );
      }

      request = new Request(request, { headers });
    }

    const response = await handler.fetch(request, env, ctx);
    return withBrowserPrivacyHeaders(request, response);
  },
};

export default worker;
