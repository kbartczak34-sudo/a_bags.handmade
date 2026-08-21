/** Cloudflare Worker entry point for A-Bags Handmade. */
import {
  handleImageOptimization,
  DEFAULT_DEVICE_SIZES,
  DEFAULT_IMAGE_SIZES,
} from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { setRuntimeBindings } from "../lib/runtime-env";

interface Env {
  ASSETS: Fetcher;
  ABAGSDB26081901: D1Database;
  ABAGSMEDIA26081901: R2Bucket;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
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
    pathname === "/panel" ||
    pathname.startsWith("/panel/") ||
    pathname === "/site-admin" ||
    pathname.startsWith("/site-admin/") ||
    pathname === "/api/admin" ||
    pathname.startsWith("/api/admin/")
  );
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

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
