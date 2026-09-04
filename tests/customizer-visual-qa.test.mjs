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

test("mobile acceptance uses full-screen V4 shell with a loaded Photo-True base", () => {
  assert.match(photoSmoke, /mobile\.width < 388/);
  assert.match(photoSmoke, /mobile\.width > 392/);
  assert.match(photoSmoke, /mobile\.height < 840/);
  assert.match(photoSmoke, /mobile\.headerHeight < 48/);
  assert.match(photoSmoke, /mobile\.headerHeight > 56/);
  assert.match(photoSmoke, /mobile\.previewTop < 45/);
  assert.match(photoSmoke, /mobile\.previewTop > 75/);
  assert.match(photoSmoke, /mobile\.previewHeight < 300/);
  assert.match(photoSmoke, /mobile\.baseLoaded/);
  assert.match(photoSmoke, /mobile\.scrollY !== 0/);
});

test("Photo-True acceptance refuses any visible synthetic product renderer", () => {
  assert.match(photoSmoke, /visibleSynthetic/);
  assert.match(photoSmoke, /:scope > svg/);
  assert.match(photoSmoke, /\.abags-pro3d-layer/);
  assert.match(photoSmoke, /\.abags-canvas3d-layer/);
  assert.match(photoSmoke, /desktopBefore\.visibleSynthetic !== 0/);
  assert.match(photoSmoke, /mobileContract\.visibleSynthetic !== 0/);
});

test("deployment uploads short-lived V5 visual artifacts and gates mobile real-product interaction", () => {
  assert.match(workflow, /Browser test Photo-True V5 and capture real-product visual QA/);
  assert.match(workflow, /ABAGS_VISUAL_QA_DIR: artifacts\/customizer-v5/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.match(workflow, /customizer-visual-qa-\$\{\{ github\.run_number \}\}/);
  assert.match(workflow, /artifacts\/customizer-v5\/\*\.png/);
  assert.match(workflow, /retention-days: 7/);
  assert.match(workflow, /steps\.customizer\.outcome == 'success'/);
  assert.match(workflow, /smoke-photo-true-mobile\.mjs/);
  assert.match(workflow, /Photo-True V5 browser\/visual acceptance failed/);
  assert.match(mobileSmoke, /visibleSynthetic/);
  assert.match(mobileSmoke, /touch-selected real product/);
  assert.match(mobileSmoke, /screenshot hash|screenshotHash/);
});
