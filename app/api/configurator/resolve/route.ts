import { getBagBuilderSettings } from "../../../../lib/bag-builder-settings";
import { getCraftCalibrationSnapshot } from "../../../../lib/craft-calibration";
import { getCraftCordColorBindings } from "../../../../lib/craft-color-bindings";
import { getCraftAccessorySnapshot } from "../../../../lib/craft-accessories";
import { getCraftBuilderAccessoryBindings } from "../../../../lib/craft-builder-accessory-bindings";
import {
  ConfiguratorInputError,
  resolveBagBuilderConfiguration,
} from "../../../../lib/configurator-resolver";
import { isProductConfigurationV2Source } from "../../../../lib/product-configuration-v2";
import { resolveAccessoryBoundProductConfigurationV2 } from "../../../../lib/product-configuration-v2-accessories";

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
    if (isProductConfigurationV2Source(source)) {
      let calibration: Awaited<ReturnType<typeof getCraftCalibrationSnapshot>>;
      let colorBindings: Awaited<ReturnType<typeof getCraftCordColorBindings>>;
      let accessorySnapshot: Awaited<ReturnType<typeof getCraftAccessorySnapshot>>;
      let accessoryBindings: Awaited<ReturnType<typeof getCraftBuilderAccessoryBindings>>;
      try {
        [calibration, colorBindings, accessorySnapshot, accessoryBindings] = await Promise.all([
          getCraftCalibrationSnapshot(),
          getCraftCordColorBindings(),
          getCraftAccessorySnapshot(),
          getCraftBuilderAccessoryBindings(),
        ]);
      } catch (error) {
        console.error("[configurator-resolve] physical evidence load failed", {
          message: error instanceof Error ? error.message : "Unknown error",
        });
        return json(
          { error: "Nie udało się sprawdzić fizycznych dowodów projektu.", code: "PHYSICAL_EVIDENCE_UNAVAILABLE" },
          503,
        );
      }
      return json(await resolveAccessoryBoundProductConfigurationV2(
        source,
        settings,
        calibration,
        colorBindings,
        accessoryBindings,
        accessorySnapshot,
      ));
    }

    return json(await resolveBagBuilderConfiguration(source, settings));
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
