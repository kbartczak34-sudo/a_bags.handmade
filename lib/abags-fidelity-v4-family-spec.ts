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
 * The renderer may recolour and combine explicitly supported accessories, but
 * the body silhouette, depth, handle/hardware anchors and construction ratios
 * stay calibrated to real A-Bags Handmade products. Technical keys remain
 * unchanged because they are persisted in saved customer projects and QA.
 */
export const ABAGS_FIDELITY_V4_FAMILY_SPECS: Readonly<Record<FidelityV4Family, FidelityV4FamilySpec>> = {
  tote: {
    label: "Kuferek / tote",
    reference: "pastel-tote-wood-bow",
    rx: 1.04,
    ry: 0.72,
    power: 7.2,
    taper: -0.018,
    depth: 0.31,
    bevel: 0.035,
    topY: 0.73,
    sideAnchor: 0.96,
    ringY: 0.49,
    handleScale: [0.96, 0.82],
    flapScale: [0.94, 0.82],
    flapY: 0.25,
  },
  round: {
    label: "Okrągła",
    reference: "cream-round-taupe-flap",
    rx: 0.88,
    ry: 0.89,
    power: 2.08,
    taper: 0,
    depth: 0.31,
    bevel: 0.038,
    topY: 0.82,
    sideAnchor: 0.80,
    ringY: 0.46,
    handleScale: [0.82, 0.80],
    flapScale: [0.79, 0.72],
    flapY: 0.31,
  },
  bucket: {
    label: "Z klapą",
    reference: "cream-burgundy-flap",
    rx: 0.91,
    ry: 0.72,
    power: 6.1,
    taper: 0.075,
    depth: 0.33,
    bevel: 0.038,
    topY: 0.73,
    sideAnchor: 0.82,
    ringY: 0.49,
    handleScale: [0.84, 0.76],
    flapScale: [0.91, 0.79],
    flapY: 0.27,
  },
  mini: {
    label: "Strukturalna / mini",
    reference: "small-multicolor-chain",
    rx: 0.79,
    ry: 0.58,
    power: 8.0,
    taper: -0.008,
    depth: 0.27,
    bevel: 0.030,
    topY: 0.60,
    sideAnchor: 0.72,
    ringY: 0.42,
    handleScale: [0.72, 0.62],
    flapScale: [0.76, 0.69],
    flapY: 0.20,
  },
};

export const ABAGS_FIDELITY_V4_RENDERER_VERSION = "abags-fidelity-v4-agata-1to1";
