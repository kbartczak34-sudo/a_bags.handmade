import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const probe = readFileSync("scripts/smoke-customizer-close-integrity.mjs", "utf8");
const workflow = readFileSync(".github/workflows/deploy-cloudflare.yml", "utf8");

test("customer close production probe is valid JavaScript and inspects actual rendered state", () => {
  const check = spawnSync(process.execPath, ["--check", "scripts/smoke-customizer-close-integrity.mjs"], { encoding: "utf8" });
  assert.equal(check.status, 0, check.stderr || check.stdout);
  assert.match(probe, /data-abags-customer-close-icon/);
  assert.match(probe, /data-abags-customer-close-surface/);
  assert.match(probe, /getComputedStyle\(close,'::before'\)/);
  assert.match(probe, /getComputedStyle\(close,'::after'\)/);
  assert.match(probe, /elementsFromPoint/);
  assert.match(probe, /close-integrity\.json/);
  assert.match(probe, /close-integrity-desktop\.png/);
  assert.match(probe, /marker !== "lines-v2"/);
  assert.match(probe, /stroke transform missing/);
});

test("production deploy blocks on the close integrity gate before render integrity", () => {
  const close = workflow.indexOf("id: close_integrity");
  const render = workflow.indexOf("id: render_integrity");
  assert.ok(close >= 0 && render > close);
  assert.match(workflow, /run: node scripts\/smoke-customizer-close-integrity\.mjs/);
  assert.match(workflow, /steps\.close_integrity\.outcome == 'success'/);
  assert.match(workflow, /CLOSE_INTEGRITY_OUTCOME:/);
  assert.match(workflow, /Fail when desktop customer close integrity fails/);
});
