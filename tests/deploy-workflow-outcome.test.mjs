import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = await readFile(new URL("../.github/workflows/deploy-cloudflare.yml", import.meta.url), "utf8");

test("post-deploy acceptance failures cannot be hidden by continue-on-error", () => {
  for (const step of ["smoke", "realtime", "close_integrity", "render_integrity", "anchor_integrity", "customizer", "pro3d"]) {
    assert.match(workflow, new RegExp(`steps\\.${step}\\.outcome`), `workflow must use outcome for ${step}`);
    assert.doesNotMatch(workflow, new RegExp(`steps\\.${step}\\.conclusion`), `workflow must not mask the ${step} failure`);
  }
  assert.match(workflow, /RENDER_OUTCOME: \$\{\{ steps\.render_integrity\.outcome \}\}/);
  assert.match(workflow, /MOBILE_OUTCOME: \$\{\{ steps\.pro3d\.outcome \}\}/);
});

test("render and accessory acceptance remain mandatory final gates", () => {
  assert.match(workflow, /Fail when realtime composited render integrity fails/);
  assert.match(workflow, /steps\.render_integrity\.outcome != 'success'/);
  assert.match(workflow, /Fail when accessory anchor integrity fails/);
  assert.match(workflow, /steps\.anchor_integrity\.outcome != 'success'/);
});
