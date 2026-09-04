import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const live = readFileSync("app/exact-live-customizer.tsx", "utf8");
const css = readFileSync("app/bag-builder-customer-premium-polish.css", "utf8");
const fit = readFileSync("app/bag-builder-customer-premium-fit.tsx", "utf8");

test("customer premium polish is the final customizer stylesheet", () => {
  const fidelity = live.indexOf('import "./bag-builder-fidelity3d-controls.css";');
  const premium = live.indexOf('import "./bag-builder-customer-premium-polish.css";');
  assert.ok(fidelity >= 0 && premium > fidelity);
});

test("customer stage keeps one clean live-preview label and removes both legacy 3D chips", () => {
  assert.match(css, /\.abags-pro3d-chip,/);
  assert.match(css, /\.abags-canvas3d-chip\{[\s\S]*display:none!important/);
  assert.match(css, /\.abags-v4-preview-meta span\{[\s\S]*display:none!important/);
  assert.match(css, /:not\(\[data-abags-photo-true="active"\]\)/);
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
