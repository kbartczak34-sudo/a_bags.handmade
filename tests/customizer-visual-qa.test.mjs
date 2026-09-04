import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workflow = fs.readFileSync(".github/workflows/deploy-cloudflare.yml", "utf8");
const smoke = fs.readFileSync("scripts/smoke-customizer-reference-v4.mjs", "utf8");

test("production browser smoke targets the final V4 layer while preserving the V3 compatibility marker", () => {
  assert.match(workflow, /smoke-customizer-reference-v4\.mjs/);
  assert.match(smoke, /classList\.contains\('abags-reference-layout-v4'\)/);
  assert.match(smoke, /dataset\.abagsReferenceLayout==='v3'/);
  assert.match(smoke, /dataset\.abagsReferenceV4==='true'/);
  assert.match(smoke, /A-BAGS VISUAL CUSTOMIZER/);
});

test("V4 visual QA captures fresh desktop and real 390 by 844 mobile renders", () => {
  assert.match(smoke, /width: 1440/);
  assert.match(smoke, /height: 900/);
  assert.match(smoke, /width: 390/);
  assert.match(smoke, /height: 844/);
  assert.match(smoke, /customizer-desktop-v4\.png/);
  assert.match(smoke, /customizer-mobile-v4\.png/);
  assert.match(smoke, /customizer-failure-v4\.png/);
  assert.match(smoke, /Page\.captureScreenshot/);
  assert.match(smoke, /captureBeyondViewport: false/);
  assert.match(smoke, /Page\.reload/);
  assert.match(smoke, /window\.scrollTo\(0,0\)/);
});

test("approved screenshots return to Fason after exercising every real builder decision", () => {
  assert.match(smoke, /choose\("family", "tote"\)/);
  assert.match(smoke, /choose\("accent", "scarf"\)/);
  assert.match(smoke, /stage\.dataset\.abagsRefStep='1'/);
  assert.match(smoke, /dialog\?\.dataset\.v4Step==='1'/);
  assert.match(smoke, /approved Fason step/);
  assert.match(smoke, /familyDisplay !== "grid"/);
});

test("mobile acceptance uses the compact V4 geometry rather than the obsolete V3 density", () => {
  assert.match(smoke, /mobile\.headerHeight < 48/);
  assert.match(smoke, /mobile\.headerHeight > 55/);
  assert.match(smoke, /mobile\.previewHeight < 300/);
  assert.match(smoke, /mobile\.previewHeight > 345/);
  assert.match(smoke, /mobile\.inspirationsHeight < 60/);
  assert.match(smoke, /mobile\.inspirationsHeight > 75/);
  assert.match(smoke, /mobile\.mountTop > 430/);
  assert.match(smoke, /mobile\.railDisplay !== "none"/);
  assert.match(smoke, /mobile\.titleDisplay !== "none"/);
  assert.match(smoke, /mobile\.rootPosition !== "fixed"/);
  assert.match(smoke, /mobile\.scrollY !== 0/);
});

test("V4 acceptance refuses duplicate renderer layers and visible implementation controls", () => {
  assert.match(smoke, /baseHidden/);
  assert.match(smoke, /controlsQuiet/);
  assert.match(smoke, /:scope > svg/);
  assert.match(smoke, /abags-pro3d-zoom/);
  assert.match(smoke, /abags-canvas3d-zoom/);
  assert.match(smoke, /abags-pro3d-view-controls/);
  assert.match(smoke, /abags-canvas3d-views/);
  assert.match(smoke, /desktopRenderer\.baseHidden/);
  assert.match(smoke, /mobileRenderer\.controlsQuiet/);
});

test("deployment uploads short-lived V4 visual artifacts and gates mobile touch testing on acceptance", () => {
  assert.match(workflow, /Browser test Reference Layout V4 and capture visual QA/);
  assert.match(workflow, /ABAGS_VISUAL_QA_DIR: artifacts\/customizer-v4/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.match(workflow, /customizer-visual-qa-\$\{\{ github\.run_number \}\}/);
  assert.match(workflow, /artifacts\/customizer-v4\/\*\.png/);
  assert.match(workflow, /retention-days: 7/);
  assert.match(workflow, /steps\.customizer\.outcome == 'success'/);
  assert.match(workflow, /smoke-pro3d-mobile\.mjs/);
  assert.match(workflow, /Reference Layout V4 browser\/visual acceptance failed/);
});
