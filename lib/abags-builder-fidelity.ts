export const AGATA_BUILDER_CONSTRUCTION_COMPATIBILITY = {
  "tall-tote": {
    handles: ["none", "wood-light", "wood-dark"],
    flaps: ["none"],
    straps: ["none", "woven", "chain", "woven-floral", "woven-striped", "chain-leather"],
    accents: ["none", "scarf", "bow"],
  },
  shoulder: {
    handles: ["none"],
    flaps: ["none"],
    straps: ["none", "crochet-braid"],
    accents: ["none", "scarf", "bow"],
  },
  tote: {
    handles: ["none", "wood-light", "wood-dark"],
    flaps: ["none"],
    straps: ["none", "woven", "chain"],
    accents: ["none", "scarf", "bow"],
  },
  round: {
    handles: ["none"],
    flaps: ["none", "crochet"],
    straps: ["none", "woven"],
    accents: ["none", "tassel"],
  },
  bucket: {
    handles: ["none"],
    flaps: ["none", "leather-black", "suede-burgundy"],
    straps: ["none", "leather"],
    accents: ["none", "tassel"],
  },
  satchel: {
    handles: ["none", "leather-braid"],
    flaps: ["none", "leather-cognac"],
    straps: ["none", "woven-ornament", "leather"],
    accents: ["none"],
  },
  mini: {
    handles: ["none", "wood-light"],
    flaps: ["none", "crochet"],
    straps: ["none", "woven", "chain"],
    accents: ["none", "tassel", "charm"],
  },
} as const;

export const AGATA_BUILDER_HANDLE_COMPATIBILITY = {
  "tall-tote": AGATA_BUILDER_CONSTRUCTION_COMPATIBILITY["tall-tote"].handles,
  shoulder: AGATA_BUILDER_CONSTRUCTION_COMPATIBILITY.shoulder.handles,
  tote: AGATA_BUILDER_CONSTRUCTION_COMPATIBILITY.tote.handles,
  round: AGATA_BUILDER_CONSTRUCTION_COMPATIBILITY.round.handles,
  bucket: AGATA_BUILDER_CONSTRUCTION_COMPATIBILITY.bucket.handles,
  mini: AGATA_BUILDER_CONSTRUCTION_COMPATIBILITY.mini.handles,
  satchel: AGATA_BUILDER_CONSTRUCTION_COMPATIBILITY.satchel.handles,
} as const;

export type AgataBuilderFamily = keyof typeof AGATA_BUILDER_CONSTRUCTION_COMPATIBILITY;
export type AgataBuilderConstructionKey = "handles" | "flaps" | "straps" | "accents";
export type AgataBuilderHandle = "none" | "wood-light" | "wood-dark" | "crochet" | "leather-braid";

export function isAgataBuilderConstructionSupported(
  family: string,
  key: AgataBuilderConstructionKey,
  value: string,
) {
  if (!(family in AGATA_BUILDER_CONSTRUCTION_COMPATIBILITY)) return false;
  const rules = AGATA_BUILDER_CONSTRUCTION_COMPATIBILITY[family as AgataBuilderFamily];
  return (rules[key] as readonly string[]).includes(value);
}

export function isAgataBuilderHandleSupported(family: string, handle: string) {
  return isAgataBuilderConstructionSupported(family, "handles", handle);
}
