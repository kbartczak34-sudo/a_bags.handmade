import { getABagsThreeAssetReadiness, type ABagsThreeAssetReadiness } from "./abags-three-model-registry";

/**
 * Pure readiness gate for the browser GLB renderer.
 * The renderer must remain on the proven fallback until every required
 * production asset has been published at its contract path.
 */
export function evaluateABagsThreeAssetReadiness(
  modelId: string,
  availablePaths: Iterable<string>,
): ABagsThreeAssetReadiness {
  return getABagsThreeAssetReadiness(modelId, availablePaths);
}

export function canUseABagsThreeRenderer(readiness: ABagsThreeAssetReadiness): boolean {
  return readiness.complete && readiness.missing.length === 0;
}
