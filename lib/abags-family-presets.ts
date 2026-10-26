import type { BagBuilderProjectConfig, BuilderFamily } from "./bag-builder-settings";
import { ABAGS_COGNAC_PRESET } from "./abags-cognac-model";

// A family card starts a complete, editable construction in one state update.
// These combinations follow each family's supported Agata components.
export const ABAGS_FAMILY_PRESETS = {
  tote: {
    family: "tote", color: "#E4A9B5", stitch: "classic", flap: "none",
    handles: "wood-light", strap: "none", hardware: "gold", accent: "bow",
  },
  round: {
    family: "round", color: "#E8DDCC", stitch: "shell", flap: "crochet",
    handles: "none", strap: "woven", hardware: "gold", accent: "tassel",
  },
  bucket: {
    family: "bucket", color: "#E8DDCC", stitch: "classic", flap: "suede-burgundy",
    handles: "none", strap: "leather", hardware: "gold", accent: "none",
  },
  mini: {
    family: "mini", color: "#BA9ECF", stitch: "basket", flap: "crochet",
    handles: "none", strap: "chain", hardware: "gold", accent: "tassel",
  },
  satchel: ABAGS_COGNAC_PRESET,
  "tall-tote": {
    family: "tall-tote", color: "#0E9AA7", stitch: "classic", flap: "none",
    handles: "wood-light", strap: "woven-striped", hardware: "gold", accent: "bow",
  },
  shoulder: {
    family: "shoulder", color: "#65493D", stitch: "classic", flap: "none",
    handles: "none", strap: "crochet-braid", hardware: "gold", accent: "bow",
  },
} as const satisfies Record<BuilderFamily, BagBuilderProjectConfig>;

export function createBagBuilderFamilyConfig(family: BuilderFamily): BagBuilderProjectConfig {
  return { ...ABAGS_FAMILY_PRESETS[family] };
}
