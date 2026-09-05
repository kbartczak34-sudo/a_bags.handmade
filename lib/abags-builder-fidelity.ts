export const AGATA_BUILDER_CONSTRUCTION_COMPATIBILITY = {
  tote: {
    handles: ["none", "wood-light", "wood-dark"],
    flaps: ["none"],
    straps: ["none", "woven", "chain"],
    accents: ["none", "scarf"],
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
  mini: {
    handles: ["none", "wood-light"],
    flaps: ["none", "crochet"],
    straps: ["none", "woven", "chain"],
    accents: ["none", "tassel", "charm"],
  },
} as const;

export const AGATA_BUILDER_HANDLE_COMPATIBILITY = {
  tote: AGATA_BUILDER_CONSTRUCTION_COMPATIBILITY.tote.handles,
  round: AGATA_BUILDER_CONSTRUCTION_COMPATIBILITY.round.handles,
  bucket: AGATA_BUILDER_CONSTRUCTION_COMPATIBILITY.bucket.handles,
  mini: AGATA_BUILDER_CONSTRUCTION_COMPATIBILITY.mini.handles,
} as const;

export type AgataBuilderFamily = keyof typeof AGATA_BUILDER_CONSTRUCTION_COMPATIBILITY;
export type AgataBuilderConstructionKey = "handles" | "flaps" | "straps" | "accents";
export type AgataBuilderHandle = "none" | "wood-light" | "wood-dark" | "crochet";

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