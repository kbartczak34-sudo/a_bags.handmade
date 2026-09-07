import { getBagBuilderSettings } from "../../../../lib/bag-builder-settings";
import {
  ConfiguratorInputError,
  resolveBagBuilderConfiguration,
} from "../../../../lib/configurator-resolver";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ error: "Nieprawidłowe dane projektu.", code: "INVALID_JSON" }, 400);
  }

  const source =
    typeof raw === "object" && raw && "config" in raw
      ? (raw as Record<string, unknown>).config
      : raw;

  let settings: Awaited<ReturnType<typeof getBagBuilderSettings>>;
  try {
    settings = await getBagBuilderSettings();
  } catch (error) {
    console.error("[configurator-resolve] settings load failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return json(
      { error: "Nie udało się sprawdzić ustawień konfiguratora.", code: "SETTINGS_UNAVAILABLE" },
      503,
    );
  }

  try {
    const resolved = await resolveBagBuilderConfiguration(source, settings);
    return json(resolved);
  } catch (error) {
    if (error instanceof ConfiguratorInputError) {
      return json({ error: error.message, code: error.code }, 400);
    }

    console.error("[configurator-resolve] resolver failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return json(
      { error: "Nie udało się przeliczyć projektu. Twoje wybory nie zostały zmienione.", code: "RESOLVE_FAILED" },
      500,
    );
  }
}
