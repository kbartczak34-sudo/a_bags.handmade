import { getPublicLegalConfig } from "../../../lib/legal-config";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(getPublicLegalConfig(), {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
