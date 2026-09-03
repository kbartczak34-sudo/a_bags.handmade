import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workflow = fs.readFileSync(".github/workflows/deploy-cloudflare.yml", "utf8");
const smoke = fs.readFileSync("scripts/smoke-customizer-reference-v3.mjs", "utf8");

test("production browser smoke targets Reference Layout V3 instead of legacy Bag Builder header", () => {
  assert.match(workflow, /smoke-customizer-reference-v3\.mjs/);
  assert.match(smoke, /abagsReferenceLayout === 'v3'/);
  assert.match(smoke, /A-BAGS VISUAL CUSTOMIZER/);
  assert.doesNotMatch(smoke, /Bag Builder 3\.0 header/);
});

test("visual QA captures real desktop and mobile production renders", () => {
  assert.match(smoke, /width: 1440/);
  assert.match(smoke, /height: 900/);
  assert.match(smoke, /width: 390/);
  assert.match(smoke, /height: 844/);
  assert.match(smoke, /customizer-desktop-v3\.png/);
  assert.match(smoke, /customizer-mobile-v3\.png/);
  assert.match(smoke, /Page\.captureScreenshot/);
});

test("deployment uploads short-lived screenshot artifacts without bypassing smoke gates", () => {
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.match(workflow, /customizer-visual-qa-\$\{\{ github\.run_number \}\}/);
  assert.match(workflow, /retention-days: 7/);
  assert.match(workflow, /steps\.customizer\.outcome == 'success'/);
  assert.match(workflow, /smoke-pro3d-mobile\.mjs/);
});

test("visual QA validates layout geometry and interactive preview before screenshotting", () => {
  assert.match(smoke, /desktopLayout\.previewLeft <= desktopLayout\.mountLeft/);
  assert.match(smoke, /mobileLayout\.previewTop >= mobileLayout\.mountTop/);
  assert.match(smoke, /data-abags-pro3d-ready/);
  assert.match(smoke, /data-abags-canvas3d-ready/);
  assert.match(smoke, /abags-bag-builder-v3/);
});
