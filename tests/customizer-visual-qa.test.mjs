import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workflow = fs.readFileSync(".github/workflows/deploy-cloudflare.yml", "utf8");
const photoSmoke = fs.readFileSync("scripts/smoke-customizer-photo-true-v5.mjs", "utf8");
const mobileSmoke = fs.readFileSync("scripts/smoke-photo-true-mobile.mjs", "utf8");

test("production browser smoke targets Photo-True V5 real product photography", () => {
  assert.match(workflow, /smoke-customizer-photo-true-v5\.mjs/);
  assert.match(photoSmoke, /abags-reference-layout-v4/);
  assert.match(photoSmoke, /dataset\.abagsPhotoTrue==='active'/);
  assert.match(photoSmoke, /abags-photo-true-base/);
  assert.match(photoSmoke, /naturalWidth>0/);
  assert.match(photoSmoke, /data-photo-product-choice/);
});

test("Photo-True visual QA captures fresh desktop and real 390 by 844 mobile renders", () => {
  assert.match(photoSmoke, /width: 1440/);
  assert.match(photoSmoke, /height: 900/);
  assert.match(photoSmoke, /width: 390/);
  assert.match(photoSmoke, /height: 844/);
  assert.match(photoSmoke, /customizer-desktop-v5-photo-true\.png/);
  assert.match(photoSmoke, /customizer-mobile-v5-photo-true\.png/);
  assert.match(photoSmoke, /Page\.captureScreenshot/);
  assert.match(photoSmoke, /captureBeyondViewport: false/);
  assert.match(photoSmoke, /Page\.reload/);
  assert.match(photoSmoke, /window\.scrollTo\(0,0\)/);
});

test("approved screenshots return to Fason and expose real store model cards", () => {
  assert.match(photoSmoke, /dataset\.abagsRefStep='1'/);
  assert.match(photoSmoke, /dataset\.v4Step === '1'/);
  assert.match(photoSmoke, /real store model cards/);
  assert.match(photoSmoke, /modelCount/);
  assert.match(photoSmoke, /selectedCount/);
  assert.match(photoSmoke, /switchModel/);
});

test("production QA rejects the huge blank gap formerly visible inside Fason", () => {
  assert.match(photoSmoke, /const family=d\?\.querySelector\('\[data-photo-true-family-group="true"\]'\)/);
  assert.match(photoSmoke, /fasonGap:Math\.round\(mr\.top-lr\.bottom\)/);
  assert.match(photoSmoke, /familyHeight:Math\.round\(fr\.height\)/);
  assert.match(photoSmoke, /value\.fasonGap < -2/);
  assert.match(photoSmoke, /value\.fasonGap > 32/);
  assert.match(photoSmoke, /value\.familyHeight > 340/);
  assert.match(photoSmoke, /mobileContract\?\.familyHeight > 255/);
});

test("mobile acceptance follows the cleaned Photo-True geometry from production", () => {
  assert.match(photoSmoke, /mobile\.width < 388/);
  assert.match(photoSmoke, /mobile\.width > 392/);
  assert.match(photoSmoke, /mobile\.height < 840/);
  assert.match(photoSmoke, /mobile\.height > 848/);
  assert.match(photoSmoke, /mobile\.headerHeight < 48/);
  assert.match(photoSmoke, /mobile\.headerHeight > 56/);
  assert.match(photoSmoke, /mobile\.previewTop < 48/);
  assert.match(photoSmoke, /mobile\.previewTop > 58/);
  assert.match(photoSmoke, /mobile\.previewHeight < 240/);
  assert.match(photoSmoke, /mobile\.previewHeight > 285/);
  assert.match(photoSmoke, /mobileColumnCount < 3/);
  assert.match(photoSmoke, /mobile\.baseLoaded/);
  assert.match(photoSmoke, /mobile\.scrollY !== 0/);
});

test("Photo-True acceptance refuses synthetic renderers and all legacy model UI", () => {
  assert.match(photoSmoke, /visibleSynthetic/);
  assert.match(photoSmoke, /visibleLegacyFamilyOptions/);
  assert.match(photoSmoke, /legacyInspirationsVisible/);
  assert.match(photoSmoke, /legacyFamilyLayerVisible/);
  assert.match(photoSmoke, /:scope > svg/);
  assert.match(photoSmoke, /\.abags-pro3d-layer/);
  assert.match(photoSmoke, /\.abags-canvas3d-layer/);
  assert.match(photoSmoke, /value\.visibleSynthetic !== 0/);
  assert.match(photoSmoke, /value\.visibleLegacyFamilyOptions !== 0/);
  assert.match(photoSmoke, /value\.legacyInspirationsVisible/);
  assert.match(photoSmoke, /value\.legacyFamilyLayerVisible/);
});

test("Photo-True contract is rechecked after switching the real model", () => {
  assert.match(photoSmoke, /Desktop after model switch/);
  assert.match(photoSmoke, /Mobile after model switch/);
  assert.match(photoSmoke, /assertPhotoTrueContract/);
});

test("deployment keeps Photo-True as an explicit internal reference check after customer realtime acceptance", () => {
  assert.match(workflow, /Browser test customer realtime builder from empty construction/);
  assert.match(workflow, /Browser test Photo-True V5 and capture real-product visual QA/);
  assert.match(workflow, /ABAGS_VISUAL_QA_DIR: artifacts\/customizer-v5/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.match(workflow, /customizer-visual-qa-\$\{\{ github\.run_number \}\}/);
  assert.match(workflow, /artifacts\/customizer-v5\/\*\.png/);
  assert.match(workflow, /retention-days: 7/);
  assert.match(workflow, /steps\.realtime\.outcome == 'success'/);
  assert.match(workflow, /steps\.customizer\.outcome == 'success'/);
  assert.match(workflow, /smoke-photo-true-mobile\.mjs/);
  assert.match(workflow, /internal Photo-True reference acceptance failed/);
  assert.match(mobileSmoke, /visibleSynthetic/);
  assert.match(mobileSmoke, /touch-selected real product/);
  assert.match(mobileSmoke, /screenshot hash|screenshotHash/);
});