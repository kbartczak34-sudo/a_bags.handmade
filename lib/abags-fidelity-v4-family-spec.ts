export type FidelityV4Family = "tote" | "round" | "bucket" | "mini";

export type FidelityV4FamilySpec = {
  /** Customer-facing A-Bags family represented by the technical renderer key. */
  label: string;
  /** Stable reference id for the real Agata bag used to calibrate this family. */
  reference: string;
  /** Half-width and half-height of the front silhouette in renderer units. */
  rx: number;
  ry: number;
  /** Superellipse exponent: higher values produce straighter handmade bag panels. */
  power: number;
  /** Positive = wider at top, negative = narrower at top. */
  taper: number;
  /** Front-to-back body depth. */
  depth: number;
  bevel: number;
  topY: number;
  sideAnchor: number;
  /** Family-specific vertical anchor for side hardware. */
  ringY: number;
  handleScale: readonly [number, number];
  flapScale: readonly [number, number];
  /** Family-specific flap position; null means an optional flap uses the generic position. */
  flapY: number | null;
};

/**
 * Fidelity V4 geometry contract — Agata reference locked.
 *
 * These proportions deliberately describe a BAG rather than a flat card:
 * deeper bodies, taller handmade silhouettes and softer corner transitions.
 * The renderer may recolour and combine explicitly supported accessories, but
 * the body silhouette, depth, handle/hardware anchors and construction ratios
 * stay calibrated to real A-Bags Handmade products. Technical keys remain
 * unchanged because they are persisted in saved customer projects and QA.
 */
export const ABAGS_FIDELITY_V4_FAMILY_SPECS: Readonly<Record<FidelityV4Family, FidelityV4FamilySpec>> = {
  tote: {
    label: "Kuferek / tote",
    reference: "pastel-tote-wood-bow",
    rx: 1.03,
    ry: 0.86,
    power: 5.6,
    taper: -0.045,
    depth: 0.48,
    bevel: 0.055,
    topY: 0.86,
    sideAnchor: 0.94,
    ringY: 0.55,
    handleScale: [0.94, 0.72],
    flapScale: [0.92, 0.79],
    flapY: 0.27,
  },
  round: {
    label: "Okrągła",
    reference: "cream-round-taupe-flap",
    rx: 0.88,
    ry: 0.90,
    power: 2.15,
    taper: 0,
    depth: 0.46,
    bevel: 0.052,
    topY: 0.83,
    sideAnchor: 0.81,
    ringY: 0.49,
    handleScale: [0.82, 0.76],
    flapScale: [0.79, 0.70],
    flapY: 0.31,
  },
  bucket: {
    label: "Z klapą",
    reference: "cream-burgundy-flap",
    rx: 0.92,
    ry: 0.87,
    power: 5.0,
    taper: 0.10,
    depth: 0.54,
    bevel: 0.056,
    topY: 0.86,
    sideAnchor: 0.84,
    ringY: 0.55,
    handleScale: [0.84, 0.72],
    flapScale: [0.91, 0.78],
    flapY: 0.29,
  },
  mini: {
    label: "Strukturalna / mini",
    reference: "small-multicolor-chain",
    rx: 0.79,
    ry: 0.67,
    power: 6.2,
    taper: -0.025,
    depth: 0.40,
    bevel: 0.045,
    topY: 0.65,
    sideAnchor: 0.72,
    ringY: 0.45,
    handleScale: [0.70, 0.58],
    flapScale: [0.75, 0.66],
    flapY: 0.21,
  },
};

export const ABAGS_FIDELITY_V4_RENDERER_VERSION = "abags-fidelity-v4-agata-1to1";
