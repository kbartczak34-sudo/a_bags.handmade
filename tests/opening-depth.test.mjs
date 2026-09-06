import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [stack, opening, css] = await Promise.all([
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-opening-depth.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-opening-depth.css", import.meta.url), "utf8"),
]);

test("opening depth runs after handmade edge finish and before accessory overlays", () => {
  assert.match(stack, /<BagBuilderHandmadeEdgeFinish\s*\/>[\s\S]*<BagBuilderOpeningDepth\s*\/>[\s\S]*<BagBuilderAccessoryFidelityOverlay\s*\/>/);
  assert.match(stack, /import "\.\/bag-builder-opening-depth\.css"/);
  assert.match(opening, /OPENING_VERSION = "calibrated-opening-depth-v1-inside-only"/);
});

test("opening geometry is derived from Fidelity V4 family dimensions and clipped inside the product silhouette", () => {
  assert.match(opening, /ABAGS_FIDELITY_V4_FAMILY_SPECS\[family\]/);
  assert.match(opening, /spec\.rx/);
  assert.match(opening, /spec\.ry/);
  assert.match(opening, /spec\.power/);
  assert.match(opening, /spec\.taper/);
  assert.match(opening, /spec\.depth/);
  assert.match(opening, /halfWidthAtY/);
  assert.match(opening, /context\.clip\(bodyPath\)/);
  assert.match(opening, /can never enlarge or reshape the real product outline/);
  assert.doesNotMatch(opening, /\.abags-fidelity3d-canvas\s*\{[^}]*transform:/s);
});

test("opening depth responds to the actual 3D view instead of using a flat decorative mask", () => {
  assert.match(opening, /frontZ = spec\.depth \/ 2 \+ 0\.030/);
  assert.match(opening, /rearZ = -spec\.depth \/ 2 \+ 0\.012/);
  assert.match(opening, /Math\.abs\(Math\.sin\(rotation\.y\)\)/);
  assert.match(opening, /opening\.frontPath/);
  assert.match(opening, /opening\.rearPath/);
  assert.doesNotMatch(opening, /Math\.random/);
});

test("opening pass is event driven, Photo-True safe and non-interactive on mobile", () => {
  assert.match(opening, /stage\.dataset\.abagsFinal3d !== "ready"/);
  assert.match(opening, /stage\.dataset\.abagsPhotoTrue === "active"/);
  assert.match(opening, /requestAnimationFrame/);
  assert.match(opening, /ResizeObserver/);
  assert.match(opening, /abags:fidelity3d-transform/);
  assert.doesNotMatch(opening, /setInterval|getImageData|putImageData|readPixels/);
  assert.match(css, /pointer-events:none!important/);
  assert.match(css, /touch-action:none!important/);
  assert.match(css, /z-index:6!important/);
  assert.match(css, /@media \(max-width:620px\)/);
});
