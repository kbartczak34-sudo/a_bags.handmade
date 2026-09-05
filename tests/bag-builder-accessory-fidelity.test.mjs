import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [overlay, fidelity, exactLibrary, stack, renderer] = await Promise.all([
  readFile(new URL("../app/bag-builder-accessory-fidelity-overlay.tsx", import.meta.url), "utf8"),
  readFile(new URL("../lib/abags-accessory-fidelity.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/exact-customizer-library.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-final-webgl3d.tsx", import.meta.url), "utf8"),
]);

test("customer realtime stack mounts the accessory refinement directly above final WebGL", () => {
  assert.match(stack, /<BagBuilderFinalWebGL3D\s*\/>[\s\S]*<BagBuilderAccessoryFidelityOverlay\s*\/>/);
  assert.match(stack, /import BagBuilderAccessoryFidelityOverlay/);
});

test("every accessory calibration anchor exists in the real Agata atelier library", () => {
  const ids = [
    "navy-wood-scarf-chain",
    "teal-wood-chain-stones",
    "small-multicolor-chain",
    "cream-round-taupe-flap",
    "black-leather-flap",
    "pink-purple-round",
    "red-wood-scarf",
    "pastel-tote-wood-bow",
    "mustard-envelope-butterfly",
    "green-leather-flap",
    "pink-leather-flap",
    "mustard-round-navy-flap",
    "pastel-round-blue-flap",
    "cream-burgundy-flap",
    "navy-pink-flap-tassel",
    "taupe-teal-envelope",
  ];
  for (const id of ids) {
    assert.match(fidelity, new RegExp(`"${id}"`), `${id} must be an accessory evidence anchor`);
    assert.match(exactLibrary, new RegExp(`id:"${id}"`), `${id} must exist in EXACT_ATELIER_LIBRARY`);
  }
});

test("chain, tassel, scarf, charm and flap details use dedicated refinement constructions", () => {
  assert.match(overlay, /ABAGS_ACCESSORY_VISUAL\.chainLinks/);
  assert.match(overlay, /comfortable leather shoulder section/);
  assert.match(overlay, /ABAGS_ACCESSORY_VISUAL\.tasselFringes/);
  assert.match(overlay, /bezierCurveTo/);
  assert.match(overlay, /ABAGS_ACCESSORY_VISUAL\.charmStones/);
  assert.match(overlay, /flapContour/);
  assert.match(overlay, /leatherSeamDash/);
  assert.match(overlay, /wovenDash/);
});

test("final WebGL keeps product structure but does not duplicate overlay-owned accessories", () => {
  assert.match(renderer, /Accessory fidelity overlay owns strap\/chain and accent geometry/);
  assert.doesNotMatch(renderer, /if \(config\.strap !== "none"\)/);
  assert.doesNotMatch(renderer, /if \(config\.accent === "charm"\)/);
  assert.doesNotMatch(renderer, /if \(config\.accent === "tassel"\)/);
  assert.doesNotMatch(renderer, /if \(config\.accent === "scarf"\)/);
  assert.doesNotMatch(renderer, /flapY - \.22/);
  assert.match(renderer, /if \(config\.flap !== "none"\)/);
  assert.match(renderer, /if \(config\.handles !== "none"\)/);
  assert.match(renderer, /meshes\.ring/);
});

test("accessory overlay follows final 3D rotation and zoom instead of becoming a static sticker", () => {
  assert.match(overlay, /pointerdown/);
  assert.match(overlay, /pointermove/);
  assert.match(overlay, /deltaY \* 0\.0008/);
  assert.match(overlay, /text === "Przód"/);
  assert.match(overlay, /text === "3\/4"/);
  assert.match(overlay, /text === "Bok"/);
  assert.match(overlay, /abags-pro3d-zoom input\[type=range\]/);
  assert.match(overlay, /function project\(/);
  assert.match(overlay, /Math\.PI \/ 5\.15/);
});

test("refinement is explicitly identified as evidence-calibrated overlay, not photo truth", () => {
  assert.match(fidelity, /ABAGS_ACCESSORY_FIDELITY_VERSION = "agata-accessories-v1"/);
  assert.match(fidelity, /evidence anchors, not claims that procedural rendering is a photo/i);
  assert.match(overlay, /data-abags-accessory-fidelity/);
  assert.match(overlay, /abags-accessory-fidelity-canvas/);
  assert.doesNotMatch(overlay, /pixel-perfect|photo[- ]true|1:1/i);
});