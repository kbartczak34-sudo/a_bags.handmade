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

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    setRuntimeBindings({
      DB: env.ABAGSDB26081901,
      BUCKET: env.ABAGSMEDIA26081901,
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

    // Cloudflare Access authenticates protected Worker requests before they
    // reach the application. Forward the verified identity into the headers
    // consumed by the existing Next/vinext owner-panel authorization layer.
    if (url.pathname === "/site-admin" || url.pathname.startsWith("/site-admin/")) {
      const identity = ctx.access ? await ctx.access.getIdentity() : null;

      if (identity?.email) {
        const headers = new Headers(request.headers);
        headers.set("cf-access-authenticated-user-email", identity.email.trim().toLowerCase());

        if (identity.name) {
          headers.set("oai-authenticated-user-full-name", encodeURIComponent(identity.name));
          headers.set("oai-authenticated-user-full-name-encoding", "percent-encoded-utf-8");
        }

        request = new Request(request, { headers });
      }
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
