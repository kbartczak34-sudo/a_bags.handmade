/** Color identifiers are stable values in saved projects; colors run bottom to top. */
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

export type AbagsYarnPalette = typeof ABAGS_YARN_PALETTES[number];
export function getAbagsYarnPalette(color: string) {
  return ABAGS_YARN_PALETTES.find(palette => palette.color === color.toUpperCase());
}
