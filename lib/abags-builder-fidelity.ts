export const AGATA_BUILDER_HANDLE_COMPATIBILITY = {
  // Real tote references use light or dark wooden handles. "none" remains a neutral draft state.
  tote: ["none", "wood-light", "wood-dark"],
  // Photographed round references use no rigid handle.
  round: ["none"],
  // Photographed flap-family references use a shoulder strap and no rigid handle.
  bucket: ["none"],
  // The structured teal reference proves a light wooden handle is a real Agata construction.
  mini: ["none", "wood-light"],
} as const;

export type AgataBuilderFamily = keyof typeof AGATA_BUILDER_HANDLE_COMPATIBILITY;
export type AgataBuilderHandle = "none" | "wood-light" | "wood-dark" | "crochet";

export function isAgataBuilderHandleSupported(family: string, handle: string) {
  if (!(family in AGATA_BUILDER_HANDLE_COMPATIBILITY)) return false;
  return (AGATA_BUILDER_HANDLE_COMPATIBILITY[family as AgataBuilderFamily] as readonly string[]).includes(handle);
}
