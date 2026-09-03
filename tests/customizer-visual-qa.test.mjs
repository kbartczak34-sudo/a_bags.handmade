import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workflow = fs.readFileSync(".github/workflows/deploy-cloudflare.yml", "utf8");
const smoke = fs.readFileSync("scripts/smoke-customizer-reference-v3.mjs", "utf8");

test("production browser smoke targets Reference Layout V3 instead of legacy Bag Builder header", () => {
  assert.match(workflow, /smoke-customizer-reference-v3\.mjs/);
  assert.match(smoke, /dataset\.abagsReferenceLayout==='v3'/);
  assert.match(smoke, /A-BAGS VISUAL CUSTOMIZER/);
  assert.doesNotMatch(smoke, /Bag Builder 3\.0 header/);
});

test("visual QA captures real desktop and mobile production renders", () => {
  assert.match(smoke, /width: 1440/);
  assert.match(smoke, /height: 900/);
  assert.match(smoke, /width: 390/);
  assert.match(smoke, /height: 844/);
  assert.match(smoke, /customizer-diagnostic-v3\.png/);
  assert.match(smoke, /customizer-desktop-v3\.png/);
  assert.match(smoke, /customizer-mobile-v3\.png/);
  assert.match(smoke, /customizer-failure-v3\.png/);
  assert.match(smoke, /Page\.captureScreenshot/);
  assert.match(smoke, /captureBeyondViewport: false/);
});

test("mobile visual QA reloads at the real mobile viewport instead of resizing a scrolled desktop page", () => {
  const mobileMetrics = smoke.indexOf("width: 390");
  const mobileReload = smoke.indexOf('Page.reload", { ignoreCache: true }', mobileMetrics);
  const mobileOpen = smoke.indexOf("await openCustomizer();", mobileReload);
  assert.ok(mobileMetrics >= 0, "mobile metrics must exist");
  assert.ok(mobileReload > mobileMetrics, "mobile page must reload after mobile metrics are applied");
  assert.ok(mobileOpen > mobileReload, "customizer must reopen after the mobile reload");
  assert.match(smoke, /window\.scrollTo\(0,0\)/);
  assert.match(smoke, /window\.scrollY === 0/);
});

test("visual QA refuses raw or off-screen mobile markup", () => {
  assert.match(smoke, /rootStyle\.position==='fixed'/);
  assert.match(smoke, /Math\.abs\(d\.top\)<=2/);
  assert.match(smoke, /Math\.abs\(d\.left\)<=2/);
  assert.match(smoke, /p\.top>=h\.bottom-2 && p\.top<90/);
  assert.match(smoke, /m\.top>p\.top && m\.top<750/);
  assert.match(smoke, /getComputedStyle\(title\)\.display==='none'/);
  assert.match(smoke, /getComputedStyle\(eyebrow\)\.display!=='none'/);
  assert.match(smoke, /mobileLayout\.rootPosition !== "fixed"/);
  assert.match(smoke, /mobileLayout\.scrollY !== 0/);
  assert.match(smoke, /mobileLayout\.previewTop > 90/);
});

test("desktop visual QA waits for real V3 styling before screenshotting", () => {
  assert.match(smoke, /desktop visual styling readiness/);
  assert.match(smoke, /parseFloat\(dialogStyle\.borderRadius\)>=20/);
  assert.match(smoke, /previewStyle\.backgroundImage!=='none'/);
  assert.match(smoke, /parseFloat\(titleStyle\.fontSize\)>24/);
  assert.match(smoke, /rootStyle\.position==='fixed'/);
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
