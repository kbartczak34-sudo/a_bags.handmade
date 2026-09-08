export const ABAGS_THREE_ASSET_VERSION = "1" as const;

export const ABAGS_THREE_MESH_NAMES = [
  "body",
  "flap",
  "handles",
  "strap",
  "hardware",
  "accessories",
] as const;

export type ABagsThreeMeshName = (typeof ABAGS_THREE_MESH_NAMES)[number];

export type ABagsThreeTextureKind =
  | "basecolor"
  | "normal"
  | "roughness"
  | "metallic"
  | "ao";

export type ABagsThreeTextureSet = {
  basecolor: string;
  normal: string;
  roughness: string;
  metallic: string;
  ao: string;
};

export type ABagsThreeAssetManifestEntry = {
  modelId: string;
  glb: string;
  textures: ABagsThreeTextureSet;
  requiredMeshes: readonly ABagsThreeMeshName[];
};

export function createABagsThreeAssetPaths(modelId: string): ABagsThreeAssetManifestEntry {
  const safeId = encodeURIComponent(modelId.trim());
  const root = `/3d/bags/${safeId}`;
  return {
    modelId: modelId.trim(),
    glb: `${root}/model.glb`,
    textures: {
      basecolor: `${root}/textures/basecolor.webp`,
      normal: `${root}/textures/normal.webp`,
      roughness: `${root}/textures/roughness.webp`,
      metallic: `${root}/textures/metallic.webp`,
      ao: `${root}/textures/ao.webp`,
    },
    requiredMeshes: ABAGS_THREE_MESH_NAMES,
  };
}

export function isABagsThreeMeshName(value: string): value is ABagsThreeMeshName {
  return (ABAGS_THREE_MESH_NAMES as readonly string[]).includes(value);
}

export function validateABagsThreeAssetManifest(entry: ABagsThreeAssetManifestEntry) {
  const errors: string[] = [];
  if (!entry.modelId) errors.push("modelId is required");
  if (!entry.glb.endsWith("/model.glb")) errors.push("glb must point to model.glb");
  for (const key of ["basecolor", "normal", "roughness", "metallic", "ao"] as const) {
    if (!entry.textures[key].endsWith(`/${key}.webp`)) errors.push(`${key} texture must be ${key}.webp`);
  }
  for (const mesh of ABAGS_THREE_MESH_NAMES) {
    if (!entry.requiredMeshes.includes(mesh)) errors.push(`required mesh missing: ${mesh}`);
  }
  return { valid: errors.length === 0, errors };
}
