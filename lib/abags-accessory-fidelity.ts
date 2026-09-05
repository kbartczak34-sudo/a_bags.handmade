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
 * narrow mobile preview while retaining individual alternating links.
 */
export const ABAGS_ACCESSORY_VISUAL = {
  chainLinks: 26,
  tasselFringes: 9,
  charmStones: 3,
  scarfTails: 2,
  leatherSeamDash: [5, 4] as const,
  wovenDash: [9, 5] as const,
} as const;
