import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [stack, opening, css, rim] = await Promise.all([
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-opening-depth.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-opening-depth.css", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-agata-top-rim.tsx", import.meta.url), "utf8"),
]);

test("Opening Depth V2 runs below AgataTopRim and before accessory overlays", () => {
  assert.match(stack, /<BagBuilderHandmadeEdgeFinish\s*\/>[\s\S]*<BagBuilderOpeningDepth\s*\/>[\s\S]*<BagBuilderAgataTopRim\s*\/>[\s\S]*<BagBuilderAccessoryFidelityOverlay\s*\/>/);
  assert.match(stack, /import "\.\/bag-builder-opening-depth\.css"/);
  assert.match(opening, /OPENING_VERSION = "calibrated-opening-depth-v2-deep-mouth-rim-aware"/);
  assert.match(css, /z-index:6!important/);
  assert.match(rim, /rowY = spec\.ry \* \(row === 0 \? 0\.855 : 0\.790\)/);
  assert.match(opening, /family === "round" \? 0\.765 : 0\.755/);
});

test("opening geometry remains derived from Fidelity V4 and clipped strictly inside the product silhouette", () => {
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

test("Opening Depth V2 contains front, rear and recessed planes so the body reads as hollow", () => {
  assert.match(opening, /frontZ = spec\.depth \/ 2 \+ 0\.020/);
  assert.match(opening, /rearZ = -spec\.depth \/ 2 \+ 0\.018/);
  assert.match(opening, /deepZ = -spec\.depth \* 0\.16/);
  assert.match(opening, /const deepDrop = spec\.ry/);
  assert.match(opening, /const corePath = new Path2D\(\)/);
  assert.match(opening, /const deepPath = new Path2D\(\)/);
  assert.match(opening, /context\.fill\(opening\.corePath\)/);
  assert.match(opening, /context\.stroke\(opening\.deepPath\)/);
  assert.match(opening, /A second recessed plane makes the bag read as hollow/);
});

test("interior occlusion responds to yaw and tilt rather than using a flat decorative mask", () => {
  assert.match(opening, /const yaw = Math\.sin\(rotation\.y\)/);
  assert.match(opening, /const yawStrength = Math\.abs\(yaw\)/);
  assert.match(opening, /const tiltStrength = Math\.max\(0, -rotation\.x\)/);
  assert.match(opening, /const sideShade = context\.createLinearGradient/);
  assert.match(opening, /if \(yaw >= 0\)/);
  assert.match(opening, /opening\.frontPath/);
  assert.match(opening, /opening\.rearPath/);
  assert.doesNotMatch(opening, /Math\.random/);
});

test("opening pass remains event driven, Photo-True safe and non-interactive on mobile", () => {
  assert.match(opening, /stage\.dataset\.abagsFinal3d !== "ready"/);
  assert.match(opening, /stage\.dataset\.abagsPhotoTrue === "active"/);
  assert.match(opening, /requestAnimationFrame/);
  assert.match(opening, /ResizeObserver/);
  assert.match(opening, /abags:fidelity3d-transform/);
  assert.doesNotMatch(opening, /setInterval|getImageData|putImageData|readPixels/);
  assert.match(css, /pointer-events:none!important/);
  assert.match(css, /touch-action:none!important/);
  assert.match(css, /opacity:1/);
  assert.match(css, /@media \(max-width:620px\)[\s\S]*opacity:\.96/);
});
