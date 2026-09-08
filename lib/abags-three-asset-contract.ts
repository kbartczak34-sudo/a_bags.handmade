export const ABAGS_3D_ASSET_ROOT = "/3d/bags" as const;

export type ABags3DMapName = "basecolor" | "normal" | "roughness" | "metallic" | "ao";

export type ABags3DAssetSet = Readonly<{
  model: string;
  basecolor: string;
  normal: string;
  roughness: string;
  metallic: string;
  ao: string;
}>;

export function getABags3DAssetSet(modelId: string): ABags3DAssetSet {
  const id = encodeURIComponent(modelId.trim());
  const root = `${ABAGS_3D_ASSET_ROOT}/${id}`;
  return {
    model: `${root}/model.glb`,
    basecolor: `${root}/textures/basecolor.webp`,
    normal: `${root}/textures/normal.webp`,
    roughness: `${root}/textures/roughness.webp`,
    metallic: `${root}/textures/metallic.webp`,
    ao: `${root}/textures/ao.webp`,
  };
}

export const ABAGS_3D_ASSET_STRUCTURE = {
  model: "public/3d/bags/MODEL-ID/model.glb",
  textures: {
    basecolor: "public/3d/bags/MODEL-ID/textures/basecolor.webp",
    normal: "public/3d/bags/MODEL-ID/textures/normal.webp",
    roughness: "public/3d/bags/MODEL-ID/textures/roughness.webp",
    metallic: "public/3d/bags/MODEL-ID/textures/metallic.webp",
    ao: "public/3d/bags/MODEL-ID/textures/ao.webp",
  },
} as const;
