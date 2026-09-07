import {
  bagBuilderProjectCode,
  calculateBagBuilderProjectCents,
  isBagBuilderProjectCompatible,
  normalizeBagBuilderProjectConfig,
  type BagBuilderProjectConfig,
  type BagBuilderSettings,
} from "./bag-builder-settings";

export const CONFIGURATOR_RESOLVER_VERSION = "compat-v1" as const;

export type ProductConfigurationV1 = {
  schemaVersion: 1;
  source: "LEGACY_BAG_BUILDER";
  selection: BagBuilderProjectConfig;
};

export type ConfiguratorValidationIssue = {
  code: string;
  message: string;
};

export type ConfiguratorValidationResult = {
  valid: boolean;
  blockers: ConfiguratorValidationIssue[];
  warnings: ConfiguratorValidationIssue[];
};

export type ConfiguratorPhysicalValidationResult = {
  status: "NOT_VALIDATED" | "VALIDATED";
  observationalOnly: true;
  reasons: ConfiguratorValidationIssue[];
};

export type ConfiguratorPricingResult = {
  currency: "PLN";
  status: "AVAILABLE" | "DISABLED" | "UNAVAILABLE";
  grossCents: number | null;
};

export type ResolvedBagBuilderConfiguration = {
  schemaVersion: 1;
  resolverVersion: typeof CONFIGURATOR_RESOLVER_VERSION;
  configurationHash: string;
  legacyProjectCode: string;
  status: "VALID" | "BLOCKED";
  configuration: ProductConfigurationV1;
  validation: ConfiguratorValidationResult;
  physicalValidation: ConfiguratorPhysicalValidationResult;
  pricing: ConfiguratorPricingResult;
};

export class ConfiguratorInputError extends Error {
  readonly code = "INVALID_CONFIGURATION";

  constructor(message = "Projekt jest niekompletny lub zawiera nieobsługiwaną opcję.") {
    super(message);
    this.name = "ConfiguratorInputError";
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;

  const record = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    const current = record[key];
    if (current !== undefined) result[key] = canonicalize(current);
  }
  return result;
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function toProductConfigurationV1(source: unknown): ProductConfigurationV1 {
  const selection = normalizeBagBuilderProjectConfig(source);
  if (!selection) throw new ConfiguratorInputError();

  return {
    schemaVersion: 1,
    source: "LEGACY_BAG_BUILDER",
    selection,
  };
}

export async function createConfigurationHash(configuration: unknown) {
  return sha256Hex(JSON.stringify(canonicalize(configuration)));
}

export function resolveConfiguratorPricing(selection: BagBuilderProjectConfig, settings: BagBuilderSettings): ConfiguratorPricingResult {
  if (!settings.pricingEnabled) {
    return { currency: "PLN", status: "DISABLED", grossCents: null };
  }

  const grossCents = calculateBagBuilderProjectCents(selection, settings);
  if (grossCents === null || grossCents < 1) {
    return { currency: "PLN", status: "UNAVAILABLE", grossCents: null };
  }

  return { currency: "PLN", status: "AVAILABLE", grossCents };
}

function resolveLegacyPhysicalValidation(): ConfiguratorPhysicalValidationResult {
  return {
    status: "NOT_VALIDATED",
    observationalOnly: true,
    reasons: [
      {
        code: "CORD_PROFILE_NOT_BOUND",
        message: "Projekt legacy nie wskazuje jeszcze zatwierdzonego SKU sznurka, jego zmierzonej średnicy ani partii materiału.",
      },
      {
        code: "GAUGE_PROFILE_NOT_BOUND",
        message: "Projekt legacy nie jest jeszcze związany z zatwierdzonym profilem Gauge wykonanym na fizycznej próbce.",
      },
      {
        code: "GOLDEN_MASTER_NOT_BOUND",
        message: "Projekt legacy nie jest jeszcze związany z zatwierdzonym fizycznym Golden Masterem danego fasonu.",
      },
    ],
  };
}

export async function resolveBagBuilderConfiguration(
  source: unknown,
  settings: BagBuilderSettings,
): Promise<ResolvedBagBuilderConfiguration> {
  const configuration = toProductConfigurationV1(source);
  const selection = configuration.selection;
  const compatible = isBagBuilderProjectCompatible(selection, settings);

  const validation: ConfiguratorValidationResult = compatible
    ? { valid: true, blockers: [], warnings: [] }
    : {
        valid: false,
        blockers: [
          {
            code: "BUILDER_INCOMPATIBLE",
            message: "Wybrana konfiguracja nie jest możliwa dla tego fasonu.",
          },
        ],
        warnings: [],
      };

  return {
    schemaVersion: 1,
    resolverVersion: CONFIGURATOR_RESOLVER_VERSION,
    configurationHash: await createConfigurationHash(configuration),
    legacyProjectCode: bagBuilderProjectCode(selection),
    status: validation.valid ? "VALID" : "BLOCKED",
    configuration,
    validation,
    physicalValidation: resolveLegacyPhysicalValidation(),
    pricing: resolveConfiguratorPricing(selection, settings),
  };
}
