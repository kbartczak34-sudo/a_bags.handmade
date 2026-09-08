export type ABagsMaterialKind =
  | "cord"
  | "leather"
  | "suede"
  | "satin"
  | "wood"
  | "metal";

export type ABagsPbrProfile = Readonly<{
  kind: ABagsMaterialKind;
  metalness: number;
  roughness: number;
  specular: number;
  clearcoat: number;
  clearcoatRoughness: number;
  sheen: number;
  sheenRoughness: number;
  normalScale: number;
  microDetail: number;
  environmentIntensity: number;
}>;

const PROFILES: Record<ABagsMaterialKind, ABagsPbrProfile> = {
  cord: {
    kind: "cord",
    metalness: 0,
    roughness: 0.88,
    specular: 0.18,
    clearcoat: 0.02,
    clearcoatRoughness: 0.72,
    sheen: 0.18,
    sheenRoughness: 0.82,
    normalScale: 0.82,
    microDetail: 0.72,
    environmentIntensity: 0.82,
  },
  leather: {
    kind: "leather",
    metalness: 0,
    roughness: 0.46,
    specular: 0.28,
    clearcoat: 0.08,
    clearcoatRoughness: 0.38,
    sheen: 0.04,
    sheenRoughness: 0.7,
    normalScale: 0.58,
    microDetail: 0.56,
    environmentIntensity: 1.05,
  },
  suede: {
    kind: "suede",
    metalness: 0,
    roughness: 0.91,
    specular: 0.07,
    clearcoat: 0,
    clearcoatRoughness: 0.9,
    sheen: 0.26,
    sheenRoughness: 0.94,
    normalScale: 0.7,
    microDetail: 0.9,
    environmentIntensity: 0.72,
  },
  satin: {
    kind: "satin",
    metalness: 0,
    roughness: 0.34,
    specular: 0.34,
    clearcoat: 0.12,
    clearcoatRoughness: 0.24,
    sheen: 0.38,
    sheenRoughness: 0.48,
    normalScale: 0.46,
    microDetail: 0.62,
    environmentIntensity: 1.08,
  },
  wood: {
    kind: "wood",
    metalness: 0,
    roughness: 0.4,
    specular: 0.24,
    clearcoat: 0.14,
    clearcoatRoughness: 0.3,
    sheen: 0,
    sheenRoughness: 0.8,
    normalScale: 0.52,
    microDetail: 0.64,
    environmentIntensity: 0.94,
  },
  metal: {
    kind: "metal",
    metalness: 1,
    roughness: 0.2,
    specular: 0.92,
    clearcoat: 0.18,
    clearcoatRoughness: 0.18,
    sheen: 0,
    sheenRoughness: 0.8,
    normalScale: 0.28,
    microDetail: 0.46,
    environmentIntensity: 1.34,
  },
};

export function getABagsPbrProfile(kind: ABagsMaterialKind): ABagsPbrProfile {
  return PROFILES[kind];
}

export function getABagsMaterialKind(materialId: string): ABagsMaterialKind {
  const value = materialId.toLowerCase();
  if (value.includes("suede") || value.includes("zamsz")) return "suede";
  if (value.includes("satin") || value.includes("satyna")) return "satin";
  if (value.includes("wood") || value.includes("drewno")) return "wood";
  if (value.includes("metal") || value.includes("gold") || value.includes("silver") || value.includes("black")) return "metal";
  if (value.includes("leather") || value.includes("skora") || value.includes("skóra")) return "leather";
  return "cord";
}

export function schlickFresnel(cosine: number, f0: number): number {
  const c = Math.max(0, Math.min(1, cosine));
  return f0 + (1 - f0) * Math.pow(1 - c, 5);
}

export function studioEnvironmentLobe(directionY: number, directionX: number): number {
  const y = Math.max(-1, Math.min(1, directionY));
  const x = Math.max(-1, Math.min(1, directionX));
  const key = Math.exp(-Math.pow((x - 0.28) / 0.34, 2) - Math.pow((y - 0.58) / 0.48, 2));
  const fill = 0.58 * Math.exp(-Math.pow((x + 0.42) / 0.5, 2) - Math.pow((y - 0.18) / 0.7, 2));
  const rim = 0.72 * Math.exp(-Math.pow((x + 0.02) / 0.22, 2) - Math.pow((y + 0.56) / 0.36, 2));
  return 0.12 + key + fill + rim;
}
