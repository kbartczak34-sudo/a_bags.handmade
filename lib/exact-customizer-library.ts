export type ExactAtelierReference = {
  id: string;
  label: string;
  index: number;
  sourceFile: string;
  family: "tote" | "round" | "flap" | "structured";
  color: string;
  colorLabel: string;
  flap: string;
  flapLabel: string;
  handles: string;
  handlesLabel: string;
  hardware: string;
  hardwareLabel: string;
  strap: string;
  strapLabel: string;
  accent: string;
  accentLabel: string;
  stitch: string;
  stitchLabel: string;
};

export const EXACT_FAMILY_LABELS: Record<ExactAtelierReference["family"], string> = {
  tote: "Kuferek / tote",
  round: "Okrągła",
  flap: "Z klapą skórzaną",
  structured: "Prostokątna / strukturalna",
};

export const EXACT_ATELIER_SPRITE_PARTS = Array.from(
  { length: 6 },
  (_, index) => `/images/configurator/exact-live-v4/sprite-part-${String(index).padStart(2, "0")}.txt`,
);

export const EXACT_ATELIER_LIBRARY: ExactAtelierReference[] = [
  { id:"navy-wood-scarf-chain", label:"Granat · drewno · apaszka", index:0, sourceFile:"1000019517.png", family:"tote", color:"navy", colorLabel:"Głęboki granat", flap:"none", flapLabel:"Bez klapy", handles:"wood-light", handlesLabel:"Drewniane jasne", hardware:"gold", hardwareLabel:"Złote", strap:"chain-leather", strapLabel:"Łańcuszek + skóra", accent:"scarf", accentLabel:"Apaszka / kokarda", stitch:"open-v", stitchLabel:"Ażurowy V" },
  { id:"mustard-round-navy-flap", label:"Musztarda · granatowa klapa", index:1, sourceFile:"1000019515.png", family:"round", color:"mustard", colorLabel:"Musztardowy", flap:"crochet-dark", flapLabel:"Klapa szydełkowa ciemna", handles:"none", handlesLabel:"Bez uchwytów sztywnych", hardware:"gold", hardwareLabel:"Złote", strap:"woven", strapLabel:"Materiałowy haftowany", accent:"tassel", accentLabel:"Chwost", stitch:"radial", stitchLabel:"Promienisty" },
  { id:"navy-pink-flap-tassel", label:"Granat · różowa klapa i chwost", index:2, sourceFile:"1000019250.png", family:"structured", color:"navy", colorLabel:"Głęboki granat", flap:"crochet-pink", flapLabel:"Klapa szydełkowa różowa", handles:"none", handlesLabel:"Bez uchwytów sztywnych", hardware:"gold", hardwareLabel:"Złote", strap:"woven", strapLabel:"Materiałowy regulowany", accent:"tassel", accentLabel:"Chwost", stitch:"vertical-open", stitchLabel:"Pionowy ażurowy" },
  { id:"green-leather-flap", label:"Butelkowa zieleń · klapa", index:3, sourceFile:"1000019248.jpg", family:"flap", color:"green", colorLabel:"Butelkowa zieleń", flap:"leather-round", flapLabel:"Klapa skórzana półokrągła", handles:"none", handlesLabel:"Bez uchwytów sztywnych", hardware:"gold", hardwareLabel:"Złote", strap:"leather", strapLabel:"Skórzany regulowany", accent:"tassel", accentLabel:"Chwost", stitch:"open-v", stitchLabel:"Ażurowy V" },
  { id:"red-wood-scarf", label:"Czerwień · ciemne drewno", index:4, sourceFile:"1000019135.png", family:"tote", color:"red", colorLabel:"Czerwony", flap:"none", flapLabel:"Bez klapy", handles:"wood-dark", handlesLabel:"Drewniane ciemne", hardware:"gold", hardwareLabel:"Złote", strap:"woven", strapLabel:"Materiałowy regulowany", accent:"scarf", accentLabel:"Apaszka / kokarda", stitch:"open-v", stitchLabel:"Ażurowy V" },
  { id:"mustard-black-flap", label:"Musztarda · czarna klapa", index:5, sourceFile:"1000019122.jpg", family:"round", color:"mustard", colorLabel:"Musztardowy", flap:"crochet-black", flapLabel:"Klapa szydełkowa czarna", handles:"none", handlesLabel:"Bez uchwytów sztywnych", hardware:"bronze", hardwareLabel:"Antyczne złoto", strap:"none", strapLabel:"Bez paska widocznego", accent:"tassel", accentLabel:"Chwost", stitch:"radial", stitchLabel:"Promienisty" },
  { id:"pastel-tote-wood-bow", label:"Pastelowy kuferek · drewno", index:6, sourceFile:"1000019121.jpg", family:"tote", color:"pastel", colorLabel:"Pastel wielokolorowy", flap:"none", flapLabel:"Bez klapy", handles:"wood-light", handlesLabel:"Drewniane jasne", hardware:"bronze", hardwareLabel:"Antyczne złoto", strap:"none", strapLabel:"Bez paska widocznego", accent:"scarf", accentLabel:"Apaszka / kokarda", stitch:"open-v", stitchLabel:"Ażurowy V" },
  { id:"mustard-envelope-butterfly", label:"Musztarda · kopertowa klapa", index:7, sourceFile:"1000019120.png", family:"structured", color:"mustard", colorLabel:"Musztardowy", flap:"leather-envelope", flapLabel:"Klapa skórzana kopertowa", handles:"none", handlesLabel:"Bez uchwytów sztywnych", hardware:"gold", hardwareLabel:"Złote", strap:"woven", strapLabel:"Materiałowy regulowany", accent:"charm", accentLabel:"Zawieszka", stitch:"open-v", stitchLabel:"Ażurowy V" },
  { id:"pastel-round-blue-flap", label:"Pastelowa okrągła · błękit", index:8, sourceFile:"1000019119.png", family:"round", color:"pastel-blue", colorLabel:"Błękit / pastel", flap:"crochet-blue", flapLabel:"Klapa szydełkowa błękitna", handles:"none", handlesLabel:"Bez uchwytów sztywnych", hardware:"gold", hardwareLabel:"Złote", strap:"woven-pastel", strapLabel:"Materiałowy pastelowy", accent:"tassel", accentLabel:"Chwost", stitch:"radial", stitchLabel:"Promienisty" },
  { id:"pink-leather-flap", label:"Pudrowy róż · skórzana klapa", index:9, sourceFile:"1000019118.png", family:"flap", color:"pink", colorLabel:"Pudrowy róż", flap:"leather-round", flapLabel:"Klapa skórzana półokrągła", handles:"none", handlesLabel:"Bez uchwytów sztywnych", hardware:"gold", hardwareLabel:"Złote", strap:"leather-pink", strapLabel:"Skórzany różowy", accent:"none", accentLabel:"Bez ozdoby", stitch:"open-v", stitchLabel:"Ażurowy V" },
  { id:"brown-ombre-wood-scarf", label:"Brąz ombré · jasne drewno", index:10, sourceFile:"1000019407.png", family:"tote", color:"brown-ombre", colorLabel:"Brąz ombré", flap:"none", flapLabel:"Bez klapy", handles:"wood-light", handlesLabel:"Drewniane jasne", hardware:"bronze", hardwareLabel:"Antyczne złoto", strap:"none", strapLabel:"Bez paska widocznego", accent:"scarf", accentLabel:"Apaszka / kokarda", stitch:"open-v", stitchLabel:"Ażurowy V" },
  { id:"cream-round-taupe-flap", label:"Krem · taupe · chwost", index:11, sourceFile:"1000018945.png", family:"round", color:"cream", colorLabel:"Kremowy", flap:"crochet-taupe", flapLabel:"Klapa szydełkowa taupe", handles:"none", handlesLabel:"Bez uchwytów sztywnych", hardware:"gold", hardwareLabel:"Złote", strap:"woven", strapLabel:"Materiałowy regulowany", accent:"tassel", accentLabel:"Chwost", stitch:"radial", stitchLabel:"Promienisty" },
  { id:"pink-ombre-dark-wood", label:"Róż ombré · ciemne drewno", index:12, sourceFile:"1000018253.jpg", family:"tote", color:"pink-ombre", colorLabel:"Róż ombré", flap:"none", flapLabel:"Bez klapy", handles:"wood-dark", handlesLabel:"Drewniane ciemne", hardware:"gold", hardwareLabel:"Złote", strap:"woven", strapLabel:"Materiałowy regulowany", accent:"scarf", accentLabel:"Apaszka / kokarda", stitch:"open-v", stitchLabel:"Ażurowy V" },
  { id:"black-leather-flap", label:"Czerń · skórzana klapa", index:13, sourceFile:"1000017523.png", family:"flap", color:"black", colorLabel:"Czarny", flap:"leather-round", flapLabel:"Klapa skórzana półokrągła", handles:"none", handlesLabel:"Bez uchwytów sztywnych", hardware:"gold", hardwareLabel:"Złote", strap:"leather-black", strapLabel:"Skórzany czarny", accent:"tassel", accentLabel:"Chwost", stitch:"open-v", stitchLabel:"Ażurowy V" },
  { id:"teal-wood-chain-stones", label:"Turkus · drewno · łańcuszek", index:14, sourceFile:"1000019117.png", family:"structured", color:"teal", colorLabel:"Turkusowy", flap:"none", flapLabel:"Bez klapy", handles:"wood-light", handlesLabel:"Drewniane jasne", hardware:"gold", hardwareLabel:"Złote", strap:"chain-leather", strapLabel:"Łańcuszek + skóra", accent:"stones", accentLabel:"Kamienie / zawieszka", stitch:"vertical-open", stitchLabel:"Pionowy ażurowy" },
  { id:"taupe-teal-envelope", label:"Taupe · turkus · kopertowa", index:15, sourceFile:"1000019115.png", family:"structured", color:"taupe", colorLabel:"Taupe", flap:"crochet-envelope", flapLabel:"Klapa szydełkowa kopertowa", handles:"none", handlesLabel:"Bez uchwytów sztywnych", hardware:"gold", hardwareLabel:"Złote", strap:"woven-teal", strapLabel:"Materiałowy turkusowy", accent:"tassel-multi", accentLabel:"Chwost wielokolorowy", stitch:"open-v", stitchLabel:"Ażurowy V" },
  { id:"cream-burgundy-flap", label:"Krem · burgundowa klapa", index:16, sourceFile:"1000019114.png", family:"flap", color:"cream", colorLabel:"Kremowy", flap:"suede-round", flapLabel:"Klapa zamszowa półokrągła", handles:"none", handlesLabel:"Bez uchwytów sztywnych", hardware:"gold", hardwareLabel:"Złote", strap:"burgundy", strapLabel:"Burgundowy regulowany", accent:"none", accentLabel:"Bez ozdoby", stitch:"open-v", stitchLabel:"Ażurowy V" },
  { id:"small-multicolor-chain", label:"Wielokolorowa mini · łańcuszek", index:17, sourceFile:"1000017491.png", family:"structured", color:"multicolor", colorLabel:"Wielokolorowy pastel", flap:"crochet-multi", flapLabel:"Klapa szydełkowa wielokolorowa", handles:"none", handlesLabel:"Bez uchwytów sztywnych", hardware:"gold", hardwareLabel:"Złote", strap:"chain-leather", strapLabel:"Łańcuszek + skóra", accent:"tassel-multi", accentLabel:"Chwost wielokolorowy", stitch:"basket", stitchLabel:"Koszykowy" },
  { id:"pink-purple-round", label:"Róż · fioletowa klapa", index:18, sourceFile:"1000017493.png", family:"round", color:"pink", colorLabel:"Pudrowy róż", flap:"crochet-purple", flapLabel:"Klapa szydełkowa fioletowa", handles:"none", handlesLabel:"Bez uchwytów sztywnych", hardware:"gold", hardwareLabel:"Złote", strap:"woven-pastel", strapLabel:"Materiałowy pastelowy", accent:"tassel-multi", accentLabel:"Chwost wielokolorowy", stitch:"open-v", stitchLabel:"Ażurowy V" },
];
