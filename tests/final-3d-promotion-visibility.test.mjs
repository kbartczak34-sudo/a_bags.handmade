import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [stack, controller, promotionCss, realtimeCss] = await Promise.all([
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-final3d-controller.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-final3d-promotion.css", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-customer-realtime.css", import.meta.url), "utf8"),
]);

test("promotion bridge loads after the base realtime renderer CSS", () => {
  const base = stack.indexOf('import "./bag-builder-customer-realtime.css"');
  const bridge = stack.indexOf('import "./bag-builder-final3d-promotion.css"');
  assert.ok(base >= 0, "customer realtime CSS must be imported");
  assert.ok(bridge > base, "promotion bridge must load after customer realtime CSS");
});

test("controller exposes an explicit compositor promotion state before ready", () => {
  const promoting = controller.indexOf('abagsFinal3d = "promoting"');
  const ready = controller.indexOf('abagsFinal3d = "ready"');
  assert.ok(promoting >= 0, "controller must enter promoting state");
  assert.ok(ready > promoting, "ready must be reached only after promotion");
  assert.match(controller, /requestAnimationFrame[\s\S]*requestAnimationFrame/);
});

test("unverified states expose only the deterministic SVG fallback", () => {
  const unverified = /data-abags-final3d\]:not\(\[data-abags-final3d="promoting"\]\):not\(\[data-abags-final3d="ready"\]\)/;
  assert.match(promotionCss, unverified);
  assert.match(promotionCss, /not\(\[data-abags-final3d="ready"\]\) > svg\{[\s\S]*?opacity:1!important;[\s\S]*?visibility:visible!important;/);
  assert.match(promotionCss, /not\(\[data-abags-final3d="ready"\]\) > \.abags-fidelity3d-layer\{[\s\S]*?opacity:0!important;[\s\S]*?visibility:hidden!important;[\s\S]*?pointer-events:none!important;/);
  assert.match(promotionCss, /not\(\[data-abags-final3d="ready"\]\) > \.abags-fidelity3d-layer \.abags-fidelity3d-canvas\{[\s\S]*?opacity:0!important;[\s\S]*?visibility:hidden!important;/);
});

test("WebGL is actually visible while the controller is promoting it", () => {
  assert.match(promotionCss, /data-abags-final3d="promoting"[\s\S]*> \.abags-fidelity3d-layer/);
  assert.match(promotionCss, /opacity:1!important/);
  assert.match(promotionCss, /visibility:visible!important/);
  assert.match(promotionCss, /pointer-events:none!important/);
  assert.match(promotionCss, /data-abags-final3d="promoting"[\s\S]*\.abags-fidelity3d-canvas/);
});

test("SVG stays available during promotion and is hidden only when 3D is ready", () => {
  assert.match(promotionCss, /data-abags-final3d="promoting"[\s\S]*> svg[\s\S]*opacity:1!important/);
  assert.match(promotionCss, /data-abags-final3d="ready"\] > svg[\s\S]*opacity:0!important/);
  assert.match(promotionCss, /data-abags-final3d="ready"\] > \.abags-fidelity3d-layer[\s\S]*pointer-events:auto!important/);
  assert.match(realtimeCss, /data-abags-final3d="ready"\] > svg[\s\S]*opacity:0!important/);
});

test("final visibility contract stays isolated from Photo-True reference mode", () => {
  const customerIsolation = ':not([data-abags-photo-true="active"])';
  assert.ok(promotionCss.includes(customerIsolation));
  const stateRules = promotionCss.split("body.abags-vc-open").slice(1);
  assert.ok(stateRules.length >= 7, "expected explicit customer renderer state rules");
  assert.ok(stateRules.every((rule) => rule.includes(customerIsolation)), "every final 3D visibility rule must exclude Photo-True");
});

test("renderer paint metadata cannot cancel an in-flight compositor promotion", () => {
  assert.match(controller, /PAINT_METADATA = new Set\(\["data-abags-fidelity3d-frame", "data-abags-fidelity3d-frame-at"\]\)/);
  assert.match(controller, /const shouldIgnorePaintMetadata = \(records: MutationRecord\[\]\)/);
  assert.match(controller, /state !== "promoting" && state !== "ready"/);
  assert.match(controller, /stage\.dataset\.abagsFinal3dSignature === expectedSignature/);
  assert.match(controller, /stage\.dataset\.abagsFidelity3dFrame === expectedSignature/);
  assert.match(controller, /if \(shouldIgnorePaintMetadata\(records\)\) return;[\s\S]*validate\(\);/);
});

test("unrelated document mutations cannot cancel the two-frame promotion", () => {
  assert.match(controller, /if \(next === stage\) \{[\s\S]*bindCanvasEvents\(\);[\s\S]*return;[\s\S]*\}/);
  const sameStageBranch = controller.match(/if \(next === stage\) \{([\s\S]*?)\n\s*\}/)?.[1] || "";
  assert.doesNotMatch(sameStageBranch, /validate\(\)/, "unchanged-stage body scans must not revalidate and clear promotion frames");
  assert.match(controller, /bodyObserver = new MutationObserver\(findStage\)/);
});

test("real configuration and renderer health mutations still retrigger final 3D validation", () => {
  for (const attribute of [
    "data-family", "data-color", "data-stitch", "data-flap", "data-handles",
    "data-strap", "data-hardware", "data-accent", "data-abags-fidelity3d-ready", "data-abags-fidelity3d-error",
  ]) {
    assert.ok(controller.includes(`"${attribute}"`), `${attribute} must stay in the observer contract`);
  }
});
