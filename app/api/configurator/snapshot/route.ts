import { getBagBuilderSettings } from "../../../../lib/bag-builder-settings";
import { getCraftCalibrationSnapshot } from "../../../../lib/craft-calibration";
import { getCraftCordColorBindings } from "../../../../lib/craft-color-bindings";
import { getCraftAccessorySnapshot } from "../../../../lib/craft-accessories";
import { getCraftBuilderAccessoryBindings } from "../../../../lib/craft-builder-accessory-bindings";
import { getCraftAccessoryBomUsage } from "../../../../lib/craft-builder-accessory-bom-usage";
import { getCraftProductionRecipes } from "../../../../lib/craft-production-recipes";
import { isProductConfigurationV2Source } from "../../../../lib/product-configuration-v2";
import { resolveBomBoundProductConfigurationV2 } from "../../../../lib/product-configuration-v2-bom";
import { persistProductionSnapshot } from "../../../../lib/production-snapshots";
import { ConfiguratorInputError } from "../../../../lib/configurator-resolver";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ error: "Nieprawidłowe dane projektu.", code: "INVALID_JSON" }, 400);
  }

  const source = typeof raw === "object" && raw && "config" in raw
    ? (raw as Record<string, unknown>).config
    : raw;

  if (!isProductConfigurationV2Source(source)) {
    return json({ error: "Production Snapshot wymaga konfiguracji V2.", code: "V2_CONFIGURATION_REQUIRED" }, 400);
  }

  try {
    const settings = await getBagBuilderSettings();
    const [calibration, colorBindings, accessorySnapshot, accessoryBindings, bomUsage, recipes] = await Promise.all([
      getCraftCalibrationSnapshot(),
      getCraftCordColorBindings(),
      getCraftAccessorySnapshot(),
      getCraftBuilderAccessoryBindings(),
      getCraftAccessoryBomUsage(),
      getCraftProductionRecipes(),
    ]);

    const resolved = await resolveBomBoundProductConfigurationV2(
      source,
      settings,
      calibration,
      colorBindings,
      accessoryBindings,
      accessorySnapshot,
      recipes,
      bomUsage,
    );

    if (!resolved.productionPackagePreview || !resolved.productionPackageHash || resolved.bomValidation.status !== "BOM_VALIDATED") {
      return json({
        error: "Konfiguracja nie spełnia warunków utrwalenia Production Snapshot.",
        code: "PRODUCTION_SNAPSHOT_BLOCKED",
        validation: resolved.validation,
        physicalValidation: resolved.physicalValidation,
        bomValidation: resolved.bomValidation,
      }, 409);
    }

    const snapshot = await persistProductionSnapshot(resolved.productionPackagePreview);
    if (snapshot.packageHash !== resolved.productionPackageHash) {
      return json({ error: "Niezgodność hashy Production Snapshot.", code: "PRODUCTION_SNAPSHOT_HASH_MISMATCH" }, 500);
    }

    return json({
      status: "PRODUCTION_SNAPSHOT_PERSISTED",
      snapshotId: snapshot.id,
      productionPackageHash: snapshot.packageHash,
      createdAt: snapshot.createdAt,
    }, 201);
  } catch (error) {
    if (error instanceof ConfiguratorInputError) {
      return json({ error: error.message, code: error.code }, 400);
    }
    console.error("[configurator-snapshot] persistence failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return json({ error: "Nie udało się utrwalić Production Snapshot.", code: "PRODUCTION_SNAPSHOT_FAILED" }, 500);
  }
}
