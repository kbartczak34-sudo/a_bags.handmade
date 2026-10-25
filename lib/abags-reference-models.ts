import type { BagBuilderProjectConfig } from "./bag-builder-settings";

type ReferenceModel = {
  id: string; label: string; description: string; sourceFile: string; image: string | null; referenceId: string | null;
  fabric: number; fabricBase: string; fabricEdge: string; fabricFlower: string; fabricLeaf: string;
  ribbon: { span: number; height: number; tails: readonly [number, number]; width: number; tilt: number };
  config: BagBuilderProjectConfig;
};

/** Original customer photographs are references; the editable preview stays WebGL. */
export const ABAGS_REFERENCE_MODELS = [
  { id: "chocolate-crossbody-bow", label: "Listonoszka czekoladowa", description: "Szydełkowy pasek, zamek i duża kokarda",
    sourceFile: "1000019763.png", image: "/images/configurator/models/chocolate-crossbody.png", referenceId: null,
    fabric: 1, fabricBase: "#EDE5DB", fabricEdge: "#65413F", fabricFlower: "#86717D", fabricLeaf: "#8B7A7E",
    ribbon: { span: .44, height: .17, tails: [1.02, .88], width: .132, tilt: -.10 },
    config: { family: "shoulder", color: "#65493D", stitch: "classic", flap: "none", handles: "none", strap: "crochet-braid", hardware: "gold", accent: "bow" } },
  { id: "forest-ocean-wood-bow", label: "Zieleń · turkus · niebieski", description: "Wysoki kuferek ombré z drewnianymi uchwytami",
    sourceFile: "1000019645.png", image: "/images/configurator/models/forest-ocean-tote.png", referenceId: null,
    fabric: 2, fabricBase: "#DAE8C5", fabricEdge: "#A99AAD", fabricFlower: "#B3DAD4", fabricLeaf: "#5B9C5E",
    ribbon: { span: .49, height: .20, tails: [1.20, 1.06], width: .145, tilt: -.08 },
    config: { family: "tall-tote", color: "#0E9AA7", stitch: "classic", flap: "none", handles: "wood-light", strap: "woven-striped", hardware: "gold", accent: "bow" } },
  { id: "navy-tall-wood-bow", label: "Granat z drewnem", description: "Wysoki kuferek, różowa kokarda i łańcuszek ze skórą",
    sourceFile: "1000019552.jpg", image: null, referenceId: "navy-wood-scarf-chain",
    fabric: 3, fabricBase: "#EBCFD5", fabricEdge: "#29324C", fabricFlower: "#B6B6D7", fabricLeaf: "#8A9363",
    ribbon: { span: .50, height: .18, tails: [1.37, 1.18], width: .152, tilt: .05 },
    config: { family: "tall-tote", color: "#24324D", stitch: "classic", flap: "none", handles: "wood-light", strap: "chain-leather", hardware: "gold", accent: "bow" } },
  { id: "cacao-cream-wood-bow", label: "Krem · brąz ombré", description: "Jasne drewno, kremowa góra i czekoladowy dół",
    sourceFile: "1000019407.png", image: null, referenceId: "brown-ombre-wood-scarf",
    fabric: 4, fabricBase: "#F2DFCF", fabricEdge: "#746243", fabricFlower: "#C68B3F", fabricLeaf: "#727653",
    ribbon: { span: .51, height: .19, tails: [1.18, .96], width: .162, tilt: .06 },
    config: { family: "tall-tote", color: "#88583F", stitch: "classic", flap: "none", handles: "wood-light", strap: "none", hardware: "gold", accent: "bow" } },
  { id: "pastel-striped-wood-bow", label: "Pastelowe pasy", description: "Krem, róż, błękit i fiolet w wyraźnych pasach",
    sourceFile: "1000019121.jpg", image: null, referenceId: "pastel-tote-wood-bow",
    fabric: 5, fabricBase: "#F1DBDE", fabricEdge: "#D66F94", fabricFlower: "#E66D98", fabricLeaf: "#72AA77",
    ribbon: { span: .40, height: .15, tails: [1.58, 1.39], width: .133, tilt: -.04 },
    config: { family: "tall-tote", color: "#BA9ECF", stitch: "classic", flap: "none", handles: "wood-light", strap: "none", hardware: "gold", accent: "bow" } },
  { id: "rose-cream-dark-wood", label: "Fuksja · róż · krem", description: "Ciemne drewno, piwoniowa kokarda i kwiatowy pasek",
    sourceFile: "1000018863.jpg", image: null, referenceId: "pink-ombre-dark-wood",
    fabric: 6, fabricBase: "#F4E6DF", fabricEdge: "#A32C62", fabricFlower: "#CC568B", fabricLeaf: "#87A661",
    ribbon: { span: .52, height: .21, tails: [1.39, 1.13], width: .169, tilt: -.06 },
    config: { family: "tall-tote", color: "#D58FAA", stitch: "classic", flap: "none", handles: "wood-dark", strap: "woven-floral", hardware: "gold", accent: "bow" } },
] as const satisfies readonly ReferenceModel[];

export function getAbagsReferenceModel(config: { family: string; color: string }) {
  if (!config || typeof config.color !== "string") return undefined;
  return ABAGS_REFERENCE_MODELS.find(model => model.config.family === config.family && model.config.color === config.color.toUpperCase());
}

export function createAbagsReferenceModelConfig(id: string): BagBuilderProjectConfig | null {
  const model = ABAGS_REFERENCE_MODELS.find(model => model.id === id);
  return model ? { ...model.config } : null;
}
