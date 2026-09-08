import { getABags3DAssetSet, type ABags3DAssetSet } from "./abags-three-asset-contract";

export type ABagsThreeMeshName = "body" | "flap" | "handles" | "strap" | "hardware" | "accessories";
export const ABAGS_THREE_REQUIRED_MESHES: readonly ABagsThreeMeshName[] = [
  "body", "flap", "handles", "strap", "hardware", "accessories",
] as const;

export type ABagsThreeModelDefinition = Readonly<{
  modelId: string;
  label: string;
  asset: ABags3DAssetSet;
  requiredMeshes: readonly ABagsThreeMeshName[];
}>;

const FAMILY_MODEL_IDS = {
  tote: "abags-tote-v1",
  round: "abags-round-v1",
  bucket: "abags-bucket-v1",
  mini: "abags-mini-v1",
} as const;

export type ABagsThreeFamily = keyof typeof FAMILY_MODEL_IDS;

export function getABagsThreeModelId(family: string): string | null {
  return family in FAMILY_MODEL_IDS ? FAMILY_MODEL_IDS[family as ABagsThreeFamily] : null;
}

export function getABagsThreeModelDefinition(family: string): ABagsThreeModelDefinition | null {
  const modelId = getABagsThreeModelId(family);
  if (!modelId) return null;
  return {
    modelId,
    label: `A-Bags ${family}`,
    asset: getABags3DAssetSet(modelId),
    requiredMeshes: ABAGS_THREE_REQUIRED_MESHES,
  };
}

export function hasRequiredABagsThreeMeshes(names: Iterable<string>): boolean {
  const set = new Set(names);
  return ABAGS_THREE_REQUIRED_MESHES.every((name) => set.has(name));
}
