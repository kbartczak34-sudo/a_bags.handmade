import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      error: "Ten endpoint płatności został wycofany.",
      code: "LEGACY_BUILDER_CHECKOUT_RETIRED",
      message: "Zakup projektu kreatora musi przejść przez /api/configurator/checkout po utworzeniu immutable Production Snapshot.",
    },
    {
      status: 410,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
