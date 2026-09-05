import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [stack, surface, css] = await Promise.all([
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-lifelike-surface.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-lifelike-surface.css", import.meta.url), "utf8"),
]);

test("lifelike pass runs directly after calibrated WebGL without replacing product geometry", () => {
  assert.match(stack, /<BagBuilderFinalWebGL3D\s*\/>[\s\S]*<BagBuilderLifelikeSurface\s*\/>/);
  assert.match(stack, /import "\.\/bag-builder-lifelike-surface\.css"/);
  assert.doesNotMatch(surface, /bodyPath|familyContour|superellipseContour|beveledExtrusion/);
  assert.match(surface, /SOURCE_SELECTOR = "\.abags-fidelity3d-canvas"/);
  assert.match(surface, /drawImage\(source, 0, 0, width, height\)/);
});

test("polyester realism remains neutral and deterministic", () => {
  assert.match(surface, /createFibrePattern/);
  assert.match(surface, /seed = 0x2a6b73d/);
  assert.match(surface, /selected Pimiotki polyester cord/);
  assert.match(surface, /keyLight/);
  assert.match(surface, /bodyDepth/);
  assert.match(surface, /edgeDepth/);
  assert.match(surface, /const sheen/);
  assert.doesNotMatch(surface, /setInterval|Math\.random/);
});

test("lifelike surface waits for verified 3D and never steals gestures", () => {
  assert.match(surface, /stage\.dataset\.abagsFinal3d !== "ready"/);
  assert.match(surface, /abags:fidelity3d-transform/);
  assert.match(surface, /requestAnimationFrame\(paint\)/);
  assert.match(surface, /abagsLifelikeSource = "calibrated-webgl-v4"/);
  assert.match(css, /pointer-events:none!important/);
  assert.match(css, /data-abags-final3d="ready"\]\[data-abags-lifelike="ready"\]/);
  assert.match(css, /mix-blend-mode:normal!important/);
});

test("mobile and accessibility contracts keep the effect lightweight", () => {
  assert.match(css, /@media\(max-width:620px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(surface, /aria-hidden="true"/);
  assert.doesNotMatch(surface, /getImageData|putImageData|readPixels/);
});
