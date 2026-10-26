/** Color identifiers are stable values in saved projects; base colors run bottom to top. */
export const ABAGS_YARN_PALETTES = [
  { color: "#0E9AA7", id: "forest-ocean", label: "Zieleń · turkus · niebieski", mode: "smooth",
    colors: ["#193BA5", "#177DA3", "#24AA99", "#79B651", "#B2C63F"], edges: [.25, .50, .75, 1],
    swatch: "linear-gradient(0deg,#193BA5,#177DA3 25%,#24AA99 50%,#79B651 75%,#B2C63F)" },
  { color: "#88583F", id: "cacao-cream", label: "Brąz ombré", mode: "smooth",
    colors: ["#39221A", "#69452F", "#9E7B5A", "#D0BDA2", "#F1EADC"], edges: [.25, .50, .75, 1],
    swatch: "linear-gradient(0deg,#39221A,#69452F 25%,#9E7B5A 50%,#D0BDA2 75%,#F1EADC)" },
  { color: "#BA9ECF", id: "pastel-bands", label: "Pastel wielokolorowy", mode: "bands",
    colors: ["#9255BE", "#ACCDE6", "#EFA8BB", "#F1E9D7", "#F1E9D7"], edges: [.27, .53, .78, 1],
    swatch: "linear-gradient(0deg,#9255BE 0% 27%,#ACCDE6 27% 53%,#EFA8BB 53% 78%,#F1E9D7 78% 100%)" },
  { color: "#D58FAA", id: "rose-cream", label: "Róż ombré", mode: "smooth",
    colors: ["#BF0866", "#DB267F", "#E88DB7", "#EDC8D3", "#F1EADD"], edges: [.25, .50, .75, 1],
    swatch: "linear-gradient(0deg,#BF0866,#DB267F 25%,#E88DB7 50%,#EDC8D3 75%,#F1EADD)" },
] as const;

// The mini is a different photographed construction from the wooden-handle
// pastel tote: turquoise, pink, cream and lilac run from left to right.
export const ABAGS_PASTEL_MINI_YARN_PALETTE = {
  color: "#BA9ECF", id: "pastel-mini-columns", label: "Pastel wielokolorowy", mode: "bands", axis: "x",
  colors: ["#3EB7BC", "#E595AD", "#F1E9D7", "#B69ACD", "#B69ACD"], edges: [.27, .51, .73, 1],
  swatch: "linear-gradient(90deg,#3EB7BC 0% 27%,#E595AD 27% 51%,#F1E9D7 51% 73%,#B69ACD 73% 100%)",
} as const;

export type AbagsYarnPalette = typeof ABAGS_YARN_PALETTES[number] | typeof ABAGS_PASTEL_MINI_YARN_PALETTE;
export function getAbagsYarnPalette(color: string, family?: string) {
  if (typeof color !== "string") return undefined;
  if (family === "mini" && color.toUpperCase() === ABAGS_PASTEL_MINI_YARN_PALETTE.color) return ABAGS_PASTEL_MINI_YARN_PALETTE;
  return ABAGS_YARN_PALETTES.find(palette => palette.color === color.toUpperCase());
}

export function getAbagsYarnSvgStops(color: string, family?: string) {
  const palette = getAbagsYarnPalette(color, family);
  if (!palette) return null;
  if ("axis" in palette && palette.axis === "x") return palette.colors.slice(0,4).flatMap((color,index)=>[
    {offset:index ? palette.edges[index-1] : 0,color}, {offset:palette.edges[index],color},
  ]);
  if (palette.mode === "bands") return [
    {offset:0,color:palette.colors[3]},{offset:.22,color:palette.colors[3]},
    {offset:.22,color:palette.colors[2]},{offset:.47,color:palette.colors[2]},
    {offset:.47,color:palette.colors[1]},{offset:.73,color:palette.colors[1]},
    {offset:.73,color:palette.colors[0]},{offset:1,color:palette.colors[0]},
  ];
  return [...palette.colors].reverse().map((color,index)=>({offset:index/4,color}));
}
