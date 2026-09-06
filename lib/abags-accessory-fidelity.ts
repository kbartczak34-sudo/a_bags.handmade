export const ABAGS_ACCESSORY_FIDELITY_VERSION = "agata-accessories-v1";

/**
 * Real A-Bags atelier references used to calibrate optional details in the
 * customer realtime renderer. These IDs point to EXACT_ATELIER_LIBRARY.
 * They are evidence anchors, not claims that procedural rendering is a photo.
 */
export const ABAGS_ACCESSORY_REFERENCES = {
  chain: ["navy-wood-scarf-chain", "teal-wood-chain-stones", "small-multicolor-chain"],
  tassel: ["cream-round-taupe-flap", "black-leather-flap", "pink-purple-round"],
  scarf: ["navy-wood-scarf-chain", "red-wood-scarf", "pastel-tote-wood-bow"],
  charm: ["mustard-envelope-butterfly", "teal-wood-chain-stones"],
  leatherFlap: ["green-leather-flap", "pink-leather-flap", "black-leather-flap"],
  crochetFlap: ["mustard-round-navy-flap", "pastel-round-blue-flap", "pink-purple-round"],
  suedeFlap: ["cream-burgundy-flap"],
  wovenStrap: ["red-wood-scarf", "navy-pink-flap-tassel", "taupe-teal-envelope"],
} as const;

/**
 * Screen-space refinement parameters are intentionally conservative. The
 * underlying body geometry remains the Fidelity V4 WebGL source of truth.
 * Chain cadence is dense enough to read as a continuous linked strap on the
 * narrow mobile preview while retaining individual alternating links. Smaller,
 * denser links better match the real A-Bags chain references without changing
 * either calibrated attachment point or the physical strap depth bow.
 *
 * Flexible straps are not perfectly coplanar with the front panel in the real
 * atelier references. A small depth bow keeps both attachment points fixed at
 * the calibrated side hardware while preserving visible physical depth in a
 * true side view instead of collapsing the whole strap into one vertical line.
 */
export const ABAGS_ACCESSORY_VISUAL = {
  chainLinks: 30,
  tasselFringes: 9,
  charmStones: 3,
  scarfTails: 2,
  leatherSeamDash: [5, 4] as const,
  wovenDash: [9, 5] as const,
  strapDepthBowRatio: 0.78,
  strapDepthBowMin: 0.20,
} as const;
