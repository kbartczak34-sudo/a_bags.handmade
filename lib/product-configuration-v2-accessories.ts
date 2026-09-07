import type { BagBuilderProjectConfig, BagBuilderSettings } from "./bag-builder-settings";
import type { CraftCalibrationSnapshot } from "./craft-calibration";
import type { CraftCordBuilderColorBinding } from "./craft-color-bindings";
import type { CraftAccessorySnapshot, CraftAccessoryRecord, CraftMountingProfileRecord } from "./craft-accessories";
import {
  expectedCraftAccessoryKind,
  type BuilderAccessorySlot,
  type CraftBuilderAccessoryBindingRecord,
} from "./craft-builder-accessory-bindings";
import type { ConfiguratorValidationIssue } from "./configurator-resolver";
import { resolveColorBoundProductConfigurationV2 } from "./product-configuration-v2-color-binding";

export type ResolvedAccessoryEvidenceV2 = {
  slot: BuilderAccessorySlot;
  builderValue: string;
  bindingId: string;
  accessory: {
    id: string;
    sku: string;
    kind: string;
    name: string;
    material: string;
    massG: number;
  };
  mounting: {
    id: string;
    bagFamily: string;
    anchorCount: number;
    requiresReinforcement: boolean;
  };
};

export type AccessoryValidationV2 = {
  status: "ACCESSORIES_VALIDATED" | "NOT_VALIDATED";
  requiredSlots: Array<{ slot: BuilderAccessorySlot; builderValue: string }>;
  resolved: ResolvedAccessoryEvidenceV2[];
  blockers: ConfiguratorValidationIssue[];
};

function issue(code: string, message: string): ConfiguratorValidationIssue {
  return { code, message };
}

function requiredAccessorySelections(selection: BagBuilderProjectConfig) {
  const result: Array<{ slot: BuilderAccessorySlot; builderValue: string }> = [];
  if (selection.flap !== "none") result.push({ slot: "flap", builderValue: selection.flap });
  if (selection.handles !== "none") result.push({ slot: "handles", builderValue: selection.handles });
  if (selection.strap !== "none") result.push({ slot: "strap", builderValue: selection.strap });
  result.push({ slot: "hardware", builderValue: selection.hardware });
  if (selection.accent !== "none") result.push({ slot: "accent", builderValue: selection.accent });
  return result;
}

function measuredAccessoryIsComplete(accessory: CraftAccessoryRecord) {
  const dimensions = [accessory.lengthMm, accessory.widthMm, accessory.heightMm, accessory.thicknessMm]
    .filter((value) => typeof value === "number" && Number.isFinite(value) && value > 0).length;
  return accessory.status === "VALIDATED"
    && typeof accessory.massG === "number"
    && Number.isFinite(accessory.massG)
    && accessory.massG > 0
    && dimensions >= 2;
}

function mountingIsComplete(mounting: CraftMountingProfileRecord, accessory: CraftAccessoryRecord) {
  if (mounting.status !== "VALIDATED") return false;
  if (!Number.isInteger(mounting.anchorCount) || mounting.anchorCount <= 0) return false;
  if (!Number.isFinite(mounting.minEdgeClearanceMm) || mounting.minEdgeClearanceMm < 0) return false;
  if ((accessory.kind === "HANDLE" || accessory.kind === "STRAP")
    && !(typeof mounting.validatedLoadN === "number" && Number.isFinite(mounting.validatedLoadN) && mounting.validatedLoadN > 0)) {
    return false;
  }
  return true;
}

function resolveOneAccessory(
  selection: BagBuilderProjectConfig,
  required: { slot: BuilderAccessorySlot; builderValue: string },
  bindings: readonly CraftBuilderAccessoryBindingRecord[],
  snapshot: CraftAccessorySnapshot,
): { resolved: ResolvedAccessoryEvidenceV2 | null; blockers: ConfiguratorValidationIssue[] } {
  const suffix = required.slot.toUpperCase();
  const binding = bindings.find((item) =>
    item.slot === required.slot
    && item.builderValue === required.builderValue
    && item.bagFamily === selection.family,
  );
  if (!binding) {
    return {
      resolved: null,
      blockers: [issue(
        `ACCESSORY_BINDING_MISSING_${suffix}`,
        `Brakuje fizycznego bindingu dla opcji ${required.slot}=${required.builderValue} w fasonie ${selection.family}.`,
      )],
    };
  }
  if (binding.status !== "VALIDATED") {
    return {
      resolved: null,
      blockers: [issue(
        `ACCESSORY_BINDING_NOT_VALIDATED_${suffix}`,
        `Binding ${required.slot}=${required.builderValue} nie został zatwierdzony przez pracownię.`,
      )],
    };
  }

  const accessory = snapshot.accessories.find((item) => item.id === binding.accessoryId);
  if (!accessory || accessory.kind !== expectedCraftAccessoryKind(required.slot)) {
    return {
      resolved: null,
      blockers: [issue(
        `ACCESSORY_EVIDENCE_INVALID_${suffix}`,
        `Fizyczne SKU dla ${required.slot} nie istnieje albo ma niezgodny rodzaj.`,
      )],
    };
  }
  if (!measuredAccessoryIsComplete(accessory)) {
    return {
      resolved: null,
      blockers: [issue(
        `ACCESSORY_MEASUREMENTS_NOT_VALIDATED_${suffix}`,
        `Fizyczne SKU ${accessory.sku} nie ma kompletnego zatwierdzonego zestawu pomiarów.`,
      )],
    };
  }

  const mounting = snapshot.mountingProfiles.find((item) => item.id === binding.mountingProfileId);
  if (!mounting
    || mounting.accessoryId !== accessory.id
    || mounting.bagFamily !== selection.family
    || !mountingIsComplete(mounting, accessory)) {
    return {
      resolved: null,
      blockers: [issue(
        `MOUNTING_EVIDENCE_NOT_VALIDATED_${suffix}`,
        `Profil mocowania SKU ${accessory.sku} nie jest kompletnym zatwierdzonym dowodem dla fasonu ${selection.family}.`,
      )],
    };
  }

  return {
    blockers: [],
    resolved: {
      slot: required.slot,
      builderValue: required.builderValue,
      bindingId: binding.id,
      accessory: {
        id: accessory.id,
        sku: accessory.sku,
        kind: accessory.kind,
        name: accessory.name,
        material: accessory.material,
        massG: accessory.massG!,
      },
      mounting: {
        id: mounting.id,
        bagFamily: mounting.bagFamily,
        anchorCount: mounting.anchorCount,
        requiresReinforcement: mounting.requiresReinforcement,
      },
    },
  };
}

export async function resolveAccessoryBoundProductConfigurationV2(
  source: unknown,
  settings: BagBuilderSettings,
  calibration: CraftCalibrationSnapshot,
  colorBindings: readonly CraftCordBuilderColorBinding[],
  accessoryBindings: readonly CraftBuilderAccessoryBindingRecord[],
  accessorySnapshot: CraftAccessorySnapshot,
) {
  const base = await resolveColorBoundProductConfigurationV2(source, settings, calibration, colorBindings);
  const requiredSlots = requiredAccessorySelections(base.configuration.selection);
  const resolved: ResolvedAccessoryEvidenceV2[] = [];
  const blockers: ConfiguratorValidationIssue[] = [];

  for (const required of requiredSlots) {
    const result = resolveOneAccessory(base.configuration.selection, required, accessoryBindings, accessorySnapshot);
    blockers.push(...result.blockers);
    if (result.resolved) resolved.push(result.resolved);
  }

  const accessoryValidation: AccessoryValidationV2 = {
    status: blockers.length === 0 ? "ACCESSORIES_VALIDATED" : "NOT_VALIDATED",
    requiredSlots,
    resolved,
    blockers,
  };

  const bodyValidated = base.physicalValidation.bodyStatus === "BODY_VALIDATED";
  const accessoryValidated = accessoryValidation.status === "ACCESSORIES_VALIDATED";
  const productionBlocker = issue(
    "FULL_PRODUCTION_RECIPE_NOT_VALIDATED",
    "Korpus i akcesoria mają osobne dowody fizyczne, ale pełna receptura montażu i kontroli jakości produktu nie została jeszcze zatwierdzona.",
  );

  return {
    ...base,
    status: bodyValidated && accessoryValidated ? base.status : "BLOCKED" as const,
    validation: {
      ...base.validation,
      valid: base.validation.valid && accessoryValidated,
      blockers: [...base.validation.blockers, ...blockers],
    },
    physicalValidation: {
      ...base.physicalValidation,
      fullProductBlockers: accessoryValidated ? [productionBlocker] : [...blockers, productionBlocker],
    },
    accessoryValidation,
    sellability: {
      ...base.sellability,
      message: accessoryValidated
        ? "Korpus i wybrane akcesoria mają zwalidowane dowody fizyczne. Zakup 1:1 pozostaje zablokowany do czasu zatwierdzenia pełnej receptury produkcyjnej i QC."
        : "Zakup 1:1 pozostaje zablokowany: co najmniej jedno wybrane akcesorium lub mocowanie nie ma kompletnego zatwierdzonego dowodu fizycznego.",
    },
  };
}
