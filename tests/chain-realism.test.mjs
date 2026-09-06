import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [stack, chain, fidelity] = await Promise.all([
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-chain-realism.tsx", import.meta.url), "utf8"),
  readFile(new URL("../lib/abags-accessory-fidelity.ts", import.meta.url), "utf8"),
]);

test("premium chain realism is mounted after calibrated accessory material finishing", () => {
  assert.match(stack, /<BagBuilderAccessoryFidelityOverlay\s*\/>[\s\S]*<BagBuilderAccessoryMaterialFinish\s*\/>[\s\S]*<BagBuilderChainRealism\s*\/>[\s\S]*<BagBuilderRigidMaterialFinish\s*\/>/);
  assert.match(chain, /CHAIN_VERSION = "chain-metal-v2-continuous"/);
});

test("chain keeps the authoritative A-Bags strap arc and attachment geometry", () => {
  assert.match(chain, /ABAGS_FIDELITY_V4_FAMILY_SPECS\[family\]/);
  assert.match(chain, /spec\.sideAnchor \* Math\.cos\(angle\)/);
  assert.match(chain, /spec\.ringY \+ archHeight \* Math\.sin\(angle\)/);
  assert.match(chain, /ABAGS_ACCESSORY_VISUAL\.strapDepthBowRatio/);
  assert.match(chain, /ABAGS_ACCESSORY_VISUAL\.strapDepthBowMin/);
  assert.doesNotMatch(chain, /Math\.random/);
});

test("chain uses smaller dense alternating links with physical metal response", () => {
  assert.match(fidelity, /chainLinks:\s*30/);
  assert.match(chain, /REALISTIC_LINK_COUNT = 38/);
  assert.match(chain, /const rx = 3\.72 \* scale \* center\.scale/);
  assert.match(chain, /const ry = 2\.10 \* scale \* center\.scale/);
  assert.match(chain, /index % 2 \? Math\.PI \/ 2 : 0/);
  assert.match(chain, /createLinearGradient/);
  assert.match(chain, /metal\.addColorStop\(0, palette\.highlight\)/);
  assert.match(chain, /metal\.addColorStop\(0\.58, palette\.shadow\)/);
  assert.match(chain, /palette\.glint/);
});

test("premium link cadence is distributed by projected arc length instead of rounded sample indexes", () => {
  assert.match(chain, /function projectArcByDistance/);
  assert.match(chain, /Math\.hypot\(current\.x - previous\.x, current\.y - previous\.y\)/);
  assert.match(chain, /function sampleProjectedArc/);
  assert.match(chain, /const distance = fraction \* projected\.total/);
  assert.match(chain, /sampleProjectedArc\(projected, distance - tangentDistance\)/);
  assert.match(chain, /sampleProjectedArc\(projected, distance \+ tangentDistance\)/);
  assert.doesNotMatch(chain, /Math\.round\(\(index \/ Math\.max\(1, linkCount - 1\)\)/);
});

test("black hardware remains black metal while retaining restrained reflections", () => {
  assert.match(chain, /shadow: "rgba\(4,4,5,\.84\)"/);
  assert.match(chain, /mid: "rgba\(54,54,60,\.98\)"/);
  assert.match(chain, /highlight: "rgba\(151,153,164,\.72\)"/);
  assert.match(chain, /glint: "rgba\(218,220,228,\.80\)"/);
});

test("leather shoulder section replaces links only in the calibrated centre span", () => {
  assert.match(chain, /const SHOULDER_START = 17/);
  assert.match(chain, /const SHOULDER_END = 32/);
  assert.match(chain, /const shoulderStart = SHOULDER_START \/ \(arc\.length - 1\)/);
  assert.match(chain, /const shoulderEnd = SHOULDER_END \/ \(arc\.length - 1\)/);
  assert.match(chain, /fraction >= shoulderStart && fraction <= shoulderEnd/);
  assert.match(chain, /arc\.slice\(SHOULDER_START, SHOULDER_END \+ 1\)/);
  assert.match(chain, /function drawShoulderLeather/);
});

test("new chain owns only back strap rendering and leaves front hardware intact", () => {
  assert.match(chain, /abags-accessory-fidelity-back/);
  assert.match(chain, /abags-accessory-material-finish-back/);
  assert.match(chain, /opacity:0!important/);
  assert.doesNotMatch(chain, /abags-accessory-fidelity-front[\s\S]{0,120}opacity:0/);
  assert.doesNotMatch(chain, /abags-accessory-material-finish-front[\s\S]{0,120}opacity:0/);
});

test("chain realism stays realtime, Photo-True isolated and mobile safe", () => {
  assert.match(chain, /stage\.dataset\.abagsFinal3d !== "ready"/);
  assert.match(chain, /stage\.dataset\.strap !== "chain"/);
  assert.match(chain, /stage\.dataset\.abagsPhotoTrue === "active"/);
  assert.match(chain, /requestAnimationFrame/);
  assert.match(chain, /ResizeObserver/);
  assert.match(chain, /abags:fidelity3d-transform/);
  assert.match(chain, /dprCap = window\.innerWidth <= 620 \? 1\.5 : 2/);
  assert.match(chain, /pointer-events:none!important/);
  assert.match(chain, /touch-action:none!important/);
  assert.match(chain, /aria-hidden="true"/);
  assert.doesNotMatch(chain, /setInterval/);
  assert.doesNotMatch(chain, /getImageData|putImageData|readPixels/);
});
