export const ABAGS_PRINTED_TEXTILE_ASSETS = {
  chocolate: "/images/configurator/textiles/chocolate-mauve-satin-v1.jpg",
  ocean: "/images/configurator/textiles/ocean-leaves-satin-v1.jpg",
  navy: "/images/configurator/textiles/navy-meadow-satin-v1.jpg",
  cacao: "/images/configurator/textiles/cacao-bouquets-satin-v1.jpg",
  pastel: "/images/configurator/textiles/pastel-bouquets-satin-v1.jpg",
  rose: "/images/configurator/textiles/rose-peony-satin-v1.jpg",
  raspberry: "/images/configurator/textiles/raspberry-botanical-webbing-v1.jpg",
  jacquard: "/images/configurator/textiles/copper-jacquard-webbing-v1.jpg",
  stripe: "/images/configurator/textiles/natural-striped-webbing-v1.jpg",
} as const;

type Print = { url: string; uv: readonly [number, number, number, number] };
export type AbagsPrintedTextileProfile = { id: string; scarf: Print | null; strap: Print | null };
const scarves = [
  { id: "chocolate-botanical-v1", url: ABAGS_PRINTED_TEXTILE_ASSETS.chocolate, uv: [.85,.32,.07,.10], color: [101,73,61] },
  { id: "ocean-botanical-v1", url: ABAGS_PRINTED_TEXTILE_ASSETS.ocean, uv: [.90,.30,.10,.20], color: [14,154,167] },
  { id: "navy-meadow-v1", url: ABAGS_PRINTED_TEXTILE_ASSETS.navy, uv: [.90,.32,.13,.14], color: [36,50,77] },
  { id: "cacao-sprigs-v1", url: ABAGS_PRINTED_TEXTILE_ASSETS.cacao, uv: [.85,.30,.13,.14], color: [136,88,63] },
  { id: "pastel-bouquets-v1", url: ABAGS_PRINTED_TEXTILE_ASSETS.pastel, uv: [.95,.34,.13,.14], color: [186,158,207] },
  { id: "rose-botanical-v1", url: ABAGS_PRINTED_TEXTILE_ASSETS.rose, uv: [.90,.28,.13,.14], color: [213,143,170] },
] as const;

/** Match photographed fabrics first; optional custom scarves use the nearest palette. */
export function getAbagsPrintedTextileProfile(config: {color: string; accent: string; strap: string}, referenceFabric = 0): AbagsPrintedTextileProfile {
  const color = /^#[0-9a-f]{6}$/i.test(config.color) ? [1,3,5].map(i => parseInt(config.color.slice(i,i+2),16)) : [213,143,170];
  const closest = scarves.reduce((a,b) => {
    const distance = (c: typeof scarves[number]) => c.color.reduce((sum,n,i) => sum + (n-color[i])**2,0);
    return distance(a) <= distance(b) ? a : b;
  });
  const scarf = scarves[referenceFabric - 1] ?? closest;
  let strap: Print | null = null;
  if (config.strap === "woven-floral") strap = { url: scarf === scarves[5] ? ABAGS_PRINTED_TEXTILE_ASSETS.raspberry : scarf.url, uv: [.20,.34,.12,.09] };
  else if (config.strap === "woven-ornament") strap = { url: ABAGS_PRINTED_TEXTILE_ASSETS.jacquard, uv: [.32,.50,0,.25] };
  else if (config.strap === "woven-striped") strap = { url: ABAGS_PRINTED_TEXTILE_ASSETS.stripe, uv: [.58,.50,0,0] };
  return { id: scarf.id, scarf: config.accent === "bow" || config.accent === "scarf" ? {url: scarf.url,uv: scarf.uv} : null, strap };
}
