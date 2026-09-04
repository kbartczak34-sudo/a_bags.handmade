import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const premium = fs.readFileSync("app/bag-builder-premium-canvas3d.tsx", "utf8");
const fallback = fs.readFileSync("app/bag-builder-renderer-fallback.tsx", "utf8");

test("premium fallback derives cord microtexture from the real atelier library rather than product geometry", () => {
  assert.match(premium, /EXACT_ATELIER_LIBRARY/);
  assert.match(premium, /EXACT_ATELIER_SPRITE_PARTS/);
  assert.match(premium, /Central body crop intentionally avoids handles, hardware and scene background/);
  assert.match(premium, /globalCompositeOperation = "color"/);
  assert.match(premium, /globalCompositeOperation = "multiply"/);
  assert.match(premium, /makeCordTexture/);
});

test("premium fallback keeps polyester cord smooth with raised stitch light and occlusion", () => {
  assert.match(premium, /polyester smooth rather than fuzzy/);
  assert.match(premium, /herringbone/);
  assert.match(premium, /rgba\(255,255,255/);
  assert.match(premium, /source \? 0\.24 : 0\.42/);
  assert.doesNotMatch(premium, /fuzz|fiber noise/i);
});

test("strap is rendered behind the product and is visually subordinate", () => {
  const strap = premium.indexOf("Shoulder strap is deliberately behind the bag");
  const body = premium.indexOf("Back and sides establish volume");
  assert.ok(strap > -1 && body > strap);
  assert.match(premium, /h \* 1\.88/);
  assert.match(premium, /7\.2, 0\.72/);
});

test("merchandising view uses one dominant handle instead of two competing full arches", () => {
  assert.match(premium, /One hero handle/);
  assert.doesNotMatch(premium, /frontHandle/);
  assert.doesNotMatch(premium, /backHandle/);
  assert.doesNotMatch(premium, /for \(const z of \[-zOffset, zOffset\]\)/);
  assert.match(premium, /woodGradient/);
});

test("hardware is intentionally smaller and uses subtle metallic rendering", () => {
  assert.match(premium, /drawMetal/);
  assert.match(premium, /5\.4 \* zoom/);
  assert.match(premium, /4\.1 \* zoom/);
  assert.match(premium, /#fffbe9/);
});

test("flap and accents stay configuration-driven without inventing price or manufacturing rules", () => {
  assert.match(premium, /config\.flap === "crochet"/);
  assert.match(premium, /config\.accent === "scarf"/);
  assert.match(premium, /config\.accent === "tassel"/);
  assert.match(premium, /config\.accent === "charm"/);
  assert.doesNotMatch(premium, /399/);
  assert.doesNotMatch(premium, /price|cena/i);
});

test("fallback stack now uses the premium renderer and preserves touch rescue", () => {
  assert.match(fallback, /BagBuilderPremiumCanvas3D/);
  assert.match(fallback, /BagBuilderCanvas3DTouchRescue/);
});
