import type { BagBuilderSettings } from "./bag-builder-settings";
import type { CraftCalibrationSnapshot } from "./craft-calibration";
import {
  findCraftCordBuilderColor,
  type CraftCordBuilderColorBinding,
} from "./craft-color-bindings";
import {
  resolveProductConfigurationV2,
  toProductConfigurationV2,
  type ResolvedProductConfigurationV2,
} from "./product-configuration-v2";
import type { ConfiguratorValidationIssue } from "./configurator-resolver";

function colorIssue(code: string, message: string): ConfiguratorValidationIssue {
  return { code, message };
}

export async function resolveColorBoundProductConfigurationV2(
  source: unknown,
  settings: BagBuilderSettings,
  calibration: CraftCalibrationSnapshot,
  colorBindings: readonly CraftCordBuilderColorBinding[],
): Promise<ResolvedProductConfigurationV2> {
  const configuration = toProductConfigurationV2(source);
  const base = await resolveProductConfigurationV2(configuration, settings, calibration);
  const mappedColor = findCraftCordBuilderColor(colorBindings, configuration.physicalBinding.cordMaterialId);

  let blocker: ConfiguratorValidationIssue | null = null;
  if (!mappedColor) {
    blocker = colorIssue(
      "CORD_COLOR_BINDING_MISSING",
      "Wybrany fizyczny sznurek nie został jeszcze przypisany do koloru kreatora przez pracownię.",
    );
  } else if (mappedColor !== configuration.selection.color) {
    blocker = colorIssue(
      "CORD_COLOR_MISMATCH",
      "Kolor wybrany przez klienta nie odpowiada fizycznemu SKU sznurka wskazanemu w tym projekcie.",
    );
  }

  if (!blocker) return base;

  return {
    ...base,
    status: "BLOCKED",
    validation: {
      ...base.validation,
      valid: false,
      blockers: [blocker, ...base.validation.blockers],
    },
    physicalValidation: {
      ...base.physicalValidation,
      bodyStatus: "NOT_VALIDATED",
      bodyBlockers: [blocker, ...base.physicalValidation.bodyBlockers],
    },
    resolvedPhysical: null,
  };
}
