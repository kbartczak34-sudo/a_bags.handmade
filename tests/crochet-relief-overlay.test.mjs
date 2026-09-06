import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [stack, relief, css] = await Promise.all([
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-crochet-relief-overlay.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-crochet-relief-overlay.css", import.meta.url), "utf8"),
]);

test("crochet relief is mounted after the lifelike pass and before accessory detail", () => {
  assert.match(stack, /<BagBuilderLifelikeSurface\s*\/>[\s\S]*<BagBuilderCrochetReliefOverlay\s*\/>[\s\S]*<BagBuilderAccessoryFidelityOverlay\s*\/>/);
  assert.match(stack, /import "\.\/bag-builder-crochet-relief-overlay\.css"/);
});

test("relief follows the calibrated Fidelity v4 silhouette without changing bag geometry", () => {
  assert.match(relief, /ABAGS_FIDELITY_V4_FAMILY_SPECS/);
  assert.match(relief, /function contour3d/);
  assert.match(relief, /function project/);
  assert.match(relief, /const RELIEF_VERSION = "stitch-depth-v2-handmade"/);
  assert.match(relief, /data-abags-crochet-relief-surface=\{RELIEF_VERSION\}/);
  assert.match(relief, /source\.width/);
  assert.match(relief, /source\.height/);
  assert.match(relief, /abags:fidelity3d-transform/);
  assert.doesNotMatch(relief, /Math\.random/);
  assert.doesNotMatch(relief, /setInterval/);
});

test("each crochet stitch gets a distinct deterministic raised-light construction", () => {
  assert.match(relief, /function drawClassic/);
  assert.match(relief, /function drawHerringbone/);
  assert.match(relief, /function drawBasket/);
  assert.match(relief, /function drawShell/);
  assert.match(relief, /function deterministicVariation/);
  assert.match(relief, /function handmadeOffset/);
  assert.match(relief, /function fibreGlint/);
  assert.match(relief, /raisedStroke/);
  assert.match(relief, /rgba\(35,24,27,\.27\)/);
  assert.match(relief, /rgba\(255,255,255,\.24\)/);
});

test("leather and suede flaps are cut out so crochet relief cannot contaminate non-yarn material", () => {
  assert.match(relief, /flap !== "none" && flap !== "crochet"/);
  assert.match(relief, /flapContour3d/);
  assert.match(relief, /clipPath\.addPath\(flapPath\.path\)/);
  assert.match(relief, /"evenodd"/);
});

test("mobile overlay stays non-interactive, neutral and below customer controls", () => {
  assert.match(css, /pointer-events:none!important/);
  assert.match(css, /touch-action:none!important/);
  assert.match(css, /mix-blend-mode:soft-light!important/);
  assert.match(css, /z-index:3!important/);
  assert.match(css, /abags-pro3d-view-controls[\s\S]*z-index:5!important/);
  assert.match(css, /@media\(max-width:620px\)/);
  assert.doesNotMatch(css, /\.abags-fidelity3d-canvas\s*\{[^}]*transform:/s);
});
