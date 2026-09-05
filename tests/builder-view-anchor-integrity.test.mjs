import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const probePath = new URL("../scripts/smoke-customizer-anchor-integrity.mjs", import.meta.url);
const deployPath = new URL("../.github/workflows/deploy-cloudflare.yml", import.meta.url);

test("production anchor probe verifies both accessory depth layers across all customer views", async () => {
  const probe = await readFile(probePath, "utf8");

  for (const view of ["Przód", "3/4", "Bok"]) assert.match(probe, new RegExp(view.replace("/", "\\/")));
  assert.match(probe, /abags-accessory-fidelity-back/);
  assert.match(probe, /abags-accessory-fidelity-front/);
  assert.match(probe, /back\.contactRatio < 0\.08/);
  assert.match(probe, /back\.bottomContactRatio < 0\.35/);
  assert.match(probe, /front\.contactRatio < 0\.45/);
  assert.match(probe, /back\.leftContact < 20/);
  assert.match(probe, /back\.rightContact < 20/);
  assert.match(probe, /front\.leftContact < 20/);
  assert.match(probe, /front\.rightContact < 20/);
  assert.match(probe, /analyzeRigidHandle/);
  assert.match(probe, /handle\.clusterCount < 2/);
  assert.match(probe, /handle\.separationRatio < 0\.045/);
  assert.match(probe, /primary\.pixels < 45/);
  assert.match(probe, /secondary\.pixels < 45/);
  assert.match(probe, /handle:analyzeRigidHandle\(\)/);
  assert.match(probe, /new Set\(results\.map\(\(item\) => item\.back\.hash\)\)\.size !== 3/);
  assert.match(probe, /new Set\(results\.map\(\(item\) => item\.front\.hash\)\)\.size !== 3/);
});

test("Cloudflare production deploy blocks later acceptance when accessory anchoring fails", async () => {
  const workflow = await readFile(deployPath, "utf8");

  assert.match(workflow, /id: anchor_integrity/);
  assert.match(workflow, /node scripts\/smoke-customizer-anchor-integrity\.mjs/);
  assert.match(workflow, /ACCESSORY ANCHOR INTEGRITY FAIL/);
  assert.match(workflow, /Fail when accessory anchor integrity fails/);
  assert.match(workflow, /steps\.anchor_integrity\.outcome == 'success'/);
});
