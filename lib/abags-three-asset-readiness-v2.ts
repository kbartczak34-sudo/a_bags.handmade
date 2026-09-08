export const ABAGS_THREE_ASSET_READY_SIGNAL = "data-abags-three-asset-ready" as const;
export function isABagsThreeAssetReady(value: unknown): value is "true" { return value === "true"; }
