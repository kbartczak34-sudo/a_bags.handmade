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

test("WebGL is actually visible while the controller is promoting it", () => {
  assert.match(promotionCss, /data-abags-final3d="promoting"[\s\S]*> \.abags-fidelity3d-layer/);
  assert.match(promotionCss, /opacity:1!important/);
  assert.match(promotionCss, /visibility:visible!important/);
  assert.match(promotionCss, /pointer-events:none!important/);
  assert.match(promotionCss, /data-abags-final3d="promoting"[\s\S]*\.abags-fidelity3d-canvas/);
});

test("SVG stays available during promotion and is hidden only when 3D is ready", () => {
  assert.match(promotionCss, /data-abags-final3d="promoting"[\s\S]*> svg[\s\S]*opacity:1!important/);
  assert.match(realtimeCss, /data-abags-final3d="ready"\] > svg[\s\S]*opacity:0!important/);
  assert.match(realtimeCss, /data-abags-final3d="ready"\] > \.abags-fidelity3d-layer[\s\S]*pointer-events:auto!important/);
});
