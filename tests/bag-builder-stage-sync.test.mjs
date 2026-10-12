import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const renderer = readFileSync(new URL("../app/bag-builder-fidelity3d.tsx", import.meta.url), "utf8");
const mobileCss = readFileSync(new URL("../app/bag-builder-reference-v4-product-stage.css", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../.github/workflows/deploy-cloudflare.yml", import.meta.url), "utf8");

test("Fidelity3D follows the stage that owns the visible canvas", () => {
  assert.match(renderer, /const canvasStage = canvas\?\.closest<HTMLElement>\("\.abags-bag-builder-stage"\)/);
  assert.match(renderer, /const next =\s*canvasStage\s*\?\?/);
  assert.match(renderer, /const DEFAULT_ZOOM = 0\.60/);
});

test("mobile preview controls fit the viewport without clipping the range", () => {
  assert.match(mobileCss, /\.abags-bag-builder-stage \.abags-pro3d-zoom/);
  assert.match(mobileCss, /grid-template-columns: 34px minmax\(0, 1fr\) 34px 48px !important/);
  assert.match(mobileCss, /\.abags-pro3d-zoom input\[type="range"\][\s\S]*?min-width: 0 !important/);
});

test("production browser acceptance checks cannot be silently ignored", () => {
  for (const id of ["smoke", "realtime", "close_integrity", "render_integrity", "anchor_integrity", "customizer", "pro3d"]) {
    const step = workflow.match(new RegExp("id: " + id + "\\n([\\s\\S]*?)(?=\\n      - name:|$)"));
    assert.ok(step, `workflow step ${id} exists`);
    assert.doesNotMatch(step[1], /continue-on-error:\s*true/, `workflow step ${id} must fail the run when it fails`);
  }
});
