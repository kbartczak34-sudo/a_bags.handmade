import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const live = readFileSync("app/exact-live-customizer.tsx", "utf8");
const css = readFileSync("app/bag-builder-customer-premium-polish.css", "utf8");
const fit = readFileSync("app/bag-builder-customer-premium-fit.tsx", "utf8");
const closeIcon = readFileSync("app/bag-builder-customer-close-icon.tsx", "utf8");
const realtimeQa = readFileSync("scripts/smoke-customizer-realtime.mjs", "utf8");

const legacyChips = [
  ".abags-canvas3d-chip",
  ".abags-webgl3d-chip",
  ".abags-real3d-chip",
  ".abags-pro3d-chip",
];

test("customer premium polish is the final customizer stylesheet", () => {
  const fidelity = live.indexOf('import "./bag-builder-fidelity3d-controls.css";');
  const premium = live.indexOf('import "./bag-builder-customer-premium-polish.css";');
  assert.ok(fidelity >= 0 && premium > fidelity);
});

test("customer stage keeps one clean live-preview label and removes the complete legacy 3D chip family", () => {
  for (const selector of legacyChips) assert.ok(css.includes(selector), `${selector} must be hidden in customer mode`);
  assert.match(css, /\.abags-real3d-chip\{[\s\S]*display:none!important/);
  assert.match(css, /\.abags-v4-preview-meta span\{[\s\S]*display:none!important/);
  assert.match(css, /:not\(\[data-abags-photo-true="active"\]\)/);
});

test("production realtime acceptance rejects every visible legacy 3D chip", () => {
  const check = spawnSync(process.execPath, ["--check", "scripts/smoke-customizer-realtime.mjs"], { encoding: "utf8" });
  assert.equal(check.status, 0, check.stderr || check.stdout);
  for (const selector of legacyChips) assert.ok(realtimeQa.includes(selector), `${selector} must be checked in browser QA`);
  assert.match(realtimeQa, /visibleLegacy3dChips/);
  assert.match(realtimeQa, /state\.visibleLegacy3dChips\?\.length !== 0/);
  assert.match(realtimeQa, /visible legacy 3D preview chips: 0/);
});

test("desktop customer step rail leaves enough room for Podsumowanie", () => {
  assert.match(css, /@media\(min-width:1181px\)[\s\S]*grid-template-columns:160px minmax\(0,1fr\)!important/);
  assert.match(css, /@media\(min-width:981px\) and \(max-width:1180px\)[\s\S]*grid-template-columns:132px minmax\(0,1fr\)!important/);
  assert.match(css, /:not\(\[data-abags-photo-true="active"\]\)[\s\S]*\.abags-exact-live-mount/);
});

test("desktop customer close control renders deterministic DOM lines without replacing React-owned text", () => {
  assert.match(live, /import BagBuilderCustomerCloseIcon from "\.\/bag-builder-customer-close-icon"/);
  assert.match(live, /<BagBuilderReferenceV4 \/>[\s\S]*?<BagBuilderCustomerCloseIcon \/>/);
  assert.match(closeIcon, /data-abags-customer-close-icon="lines-v2"/);
  assert.match(closeIcon, /createStroke\("45deg"\)/);
  assert.match(closeIcon, /createStroke\("-45deg"\)/);
  assert.match(closeIcon, /setImportant\(button, "font-size", "0"\)/);
  assert.match(closeIcon, /setImportant\(line, "background", "#674d53"\)/);
  assert.match(closeIcon, /const desktop = isDesktopViewport\(\)/);
  assert.match(closeIcon, /customerDesktop = desktop && dialog\.dataset\.abagsPhotoTrue !== "active"/);
  assert.doesNotMatch(closeIcon, /desktop\.matches/);
  assert.doesNotMatch(closeIcon, /matchMedia/);
  assert.doesNotMatch(closeIcon, /replaceChildren/);
  assert.doesNotMatch(closeIcon, /textContent\s*=/);
  assert.doesNotMatch(closeIcon, /createElementNS/);
});

test("desktop customer close v2 preserves restoration and does not depend on the failed SVG background path", () => {
  assert.match(closeIcon, /savedStyles/);
  assert.match(closeIcon, /button\.style\.setProperty\(property, state\.value, state\.priority\)/);
  assert.match(closeIcon, /button\.style\.removeProperty\(property\)/);
  assert.match(closeIcon, /window\.addEventListener\("resize", requestSync\)/);
  assert.doesNotMatch(closeIcon, /currentColor/);
  assert.doesNotMatch(css, /data:image\/svg\+xml/);
});

test("small mobile stage is shorter without affecting Photo-True", () => {
  assert.match(css, /@media\(max-width:420px\)[\s\S]*height:230px!important/);
  assert.match(css, /\.abags-fidelity3d-view-controls[\s\S]*top:10px!important/);
  assert.match(css, /\.abags-fidelity3d-zoom[\s\S]*bottom:10px!important/);
});

test("mobile premium fit uses the renderer's real zoom control exactly once", () => {
  assert.match(fit, /TARGET_MOBILE_ZOOM = 1\.16/);
  assert.match(fit, /\.abags-fidelity3d-zoom input\[type="range"\]/);
  assert.match(fit, /data-abags-mobile-premium-fit|abagsMobilePremiumFit/);
  assert.match(fit, /HTMLInputElement\.prototype/);
  assert.match(fit, /new Event\("input", \{ bubbles: true \}\)/);
  assert.match(fit, /stage\.dataset\.abagsFinal3d !== "ready"/);
  assert.match(fit, /abagsPhotoTrue === "active"/);
});

test("premium fit is mounted only after final 3D verification infrastructure", () => {
  const controller = live.indexOf("<BagBuilderFinal3DController />");
  const premium = live.indexOf("<BagBuilderCustomerPremiumFit />");
  assert.ok(controller >= 0 && premium > controller);
});
