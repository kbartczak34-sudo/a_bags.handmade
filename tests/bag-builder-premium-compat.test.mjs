import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const compat = fs.readFileSync("app/bag-builder-premium-compat.tsx", "utf8");
const stack = fs.readFileSync("app/exact-live-customizer.tsx", "utf8");

test("premium canvas compatibility is mounted immediately after the software renderer", () => {
  const fallback = stack.indexOf("<BagBuilderRendererFallback />");
  const compatIndex = stack.indexOf("<BagBuilderPremiumCompat />");
  assert.ok(fallback > -1);
  assert.ok(compatIndex > fallback);
});

test("premium readiness is exposed through the existing canvas acceptance contract only after the canvas exists", () => {
  assert.match(compat, /abagsCanvas3dReady === PREMIUM_VERSION/);
  assert.match(compat, /abags-premium-canvas3d-layer \.abags-premium-canvas3d-canvas/);
  assert.match(compat, /abagsPremiumCanvasVersion = PREMIUM_VERSION/);
  assert.match(compat, /abagsCanvas3dReady = "true"/);
});

test("premium canvas hides the legacy builder svg so only one product renderer is visible", () => {
  assert.match(compat, /abags-canvas3d-active:not\(\.abags-pro3d-active\) > svg/);
  assert.match(compat, /opacity: 0 !important/);
  assert.match(compat, /visibility: hidden !important/);
  assert.match(compat, /pointer-events: none !important/);
});
