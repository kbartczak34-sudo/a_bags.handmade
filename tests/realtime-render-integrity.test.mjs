import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [script, workflow] = await Promise.all([
  readFile(new URL("../scripts/smoke-customizer-render-integrity.mjs", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/deploy-cloudflare.yml", import.meta.url), "utf8"),
]);

test("render integrity QA compares browser composition with the native Fidelity3D canvas", () => {
  assert.match(script, /captureFull/);
  assert.match(script, /captureStage/);
  assert.match(script, /captureNativeCanvas/);
  assert.match(script, /Page\.captureScreenshot/);
  assert.match(script, /canvas\.toDataURL\('image\/png'\)/);
  assert.match(script, /visibleDialogCount/);
  assert.match(script, /visibleRootCount/);
  assert.match(script, /visibleLegacy/);
  assert.match(script, /elementsFromPoint/);
});

test("mobile render integrity requires the composited screenshot to preserve selected turquoise", () => {
  assert.match(script, /#087E81/);
  assert.match(script, /strongMatchRatio/);
  assert.match(script, /averageMatchSaturation/);
  assert.match(script, /Mobile composited stage screenshot does not visibly preserve selected turquoise/);
  assert.match(script, /Mobile native Fidelity3D canvas does not preserve selected turquoise/);
});

test("production deployment blocks Photo-True QA until realtime compositor integrity passes", () => {
  assert.match(workflow, /Verify realtime render integrity on the composited surface/);
  assert.match(workflow, /id: render_integrity/);
  assert.match(workflow, /node scripts\/smoke-customizer-render-integrity\.mjs/);
  assert.match(workflow, /RENDER_INTEGRITY_OUTCOME/);
  assert.match(workflow, /REALTIME RENDER INTEGRITY FAIL/);
  assert.match(workflow, /steps\.render_integrity\.outcome == 'success'[\s\S]*Browser test Photo-True V5|Browser test Photo-True V5[\s\S]*steps\.render_integrity\.outcome == 'success'/);
  assert.match(workflow, /Fail when realtime composited render integrity fails/);
});
