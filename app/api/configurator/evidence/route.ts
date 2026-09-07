import {
  BUILDER_FAMILIES,
  BUILDER_STITCHES,
  type BuilderFamily,
  type BuilderStitch,
} from "../../../../lib/bag-builder-settings";
import { getCraftCalibrationSnapshot } from "../../../../lib/craft-calibration";
import { buildPublicCraftBodyEvidenceCatalog } from "../../../../lib/public-craft-evidence";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function familyParam(value: string | null): BuilderFamily | null | "INVALID" {
  if (!value) return null;
  return (BUILDER_FAMILIES as readonly string[]).includes(value) ? value as BuilderFamily : "INVALID";
}

function stitchParam(value: string | null): BuilderStitch | null | "INVALID" {
  if (!value) return null;
  return (BUILDER_STITCHES as readonly string[]).includes(value) ? value as BuilderStitch : "INVALID";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const family = familyParam(url.searchParams.get("family"));
  const stitch = stitchParam(url.searchParams.get("stitch"));

  if (family === "INVALID") {
    return json({ error: "Nieobsługiwany fason.", code: "INVALID_FAMILY" }, 400);
  }
  if (stitch === "INVALID") {
    return json({ error: "Nieobsługiwany ścieg.", code: "INVALID_STITCH" }, 400);
  }

  try {
    const snapshot = await getCraftCalibrationSnapshot();
    return json(buildPublicCraftBodyEvidenceCatalog(snapshot, {
      ...(family ? { family } : {}),
      ...(stitch ? { stitch } : {}),
    }));
  } catch (error) {
    console.error("[configurator-evidence] load failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return json(
      { error: "Nie udało się sprawdzić zwalidowanych wariantów korpusu.", code: "EVIDENCE_UNAVAILABLE" },
      503,
    );
  }
}
