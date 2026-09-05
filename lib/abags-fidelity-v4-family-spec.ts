export type FidelityV4Family = "tote" | "round" | "bucket" | "mini";

export type FidelityV4FamilySpec = {
  /** Customer-facing A-Bags family represented by the technical renderer key. */
  label: string;
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
  handleScale: readonly [number, number];
  flapScale: readonly [number, number];
  /** Family-specific flap position; null means an optional flap uses the generic position. */
  flapY: number | null;
};

/**
 * Fidelity V4 geometry contract.
 *
 * These proportions deliberately move the procedural renderer away from the
 * soft/pillow-like V3 primitives and toward the construction language visible
 * in the A-Bags reference library: flatter front panels, firmer lower edges,
 * restrained depth and family-specific hardware/flap anchors.
 *
 * Technical keys stay unchanged because they are part of the persisted builder
 * state and production QA contract:
 *   tote   -> Kuferek / tote
 *   round  -> Okrągła
 *   bucket -> Z klapą
 *   mini   -> Strukturalna / mini
 */
export const ABAGS_FIDELITY_V4_FAMILY_SPECS: Readonly<Record<FidelityV4Family, FidelityV4FamilySpec>> = {
  tote: {
    label: "Kuferek / tote",
    rx: 1.04,
    ry: 0.72,
    power: 7.2,
    taper: -0.018,
    depth: 0.31,
    bevel: 0.035,
    topY: 0.73,
    sideAnchor: 0.96,
    handleScale: [0.96, 0.82],
    flapScale: [0.94, 0.82],
    flapY: 0.25,
  },
  round: {
    label: "Okrągła",
    rx: 0.88,
    ry: 0.89,
    power: 2.08,
    taper: 0,
    depth: 0.31,
    bevel: 0.038,
    topY: 0.82,
    sideAnchor: 0.80,
    handleScale: [0.82, 0.80],
    flapScale: [0.79, 0.72],
    flapY: 0.31,
  },
  bucket: {
    label: "Z klapą",
    rx: 0.91,
    ry: 0.72,
    power: 6.1,
    taper: 0.075,
    depth: 0.33,
    bevel: 0.038,
    topY: 0.73,
    sideAnchor: 0.82,
    handleScale: [0.84, 0.76],
    flapScale: [0.91, 0.79],
    flapY: 0.27,
  },
  mini: {
    label: "Strukturalna / mini",
    rx: 0.79,
    ry: 0.58,
    power: 8.0,
    taper: -0.008,
    depth: 0.27,
    bevel: 0.030,
    topY: 0.60,
    sideAnchor: 0.72,
    handleScale: [0.72, 0.62],
    flapScale: [0.76, 0.69],
    flapY: 0.20,
  },
};

export const ABAGS_FIDELITY_V4_RENDERER_VERSION = "abags-fidelity-v4";
