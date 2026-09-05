import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workflow = fs.readFileSync(".github/workflows/deploy-cloudflare.yml", "utf8");
const smoke = fs.readFileSync("scripts/smoke-production.sh", "utf8");

test("production deployment runs a post-deploy smoke test and records the result", () => {
  assert.match(workflow, /bash scripts\/smoke-production\.sh/);
  assert.match(workflow, /gh issue comment 21/);
  assert.match(workflow, /issues:\s*write/);
  assert.match(workflow, /steps\.smoke\.outcome/);
});

test("production smoke test covers storefront, security, PWA, APIs and admin protection", () => {
  for (const fragment of [
    'Cache-Control: no-store',
    'Vary: Cookie',
    'Content-Security-Policy',
    'strict-transport-security',
    '/robots.txt',
    '/sitemap.xml',
    '/manifest.webmanifest',
    '/api/products',
    '/api/legal-status',
    '/api/admin/status',
  ]) {
    assert.ok(smoke.toLowerCase().includes(fragment.toLowerCase()), `missing smoke assertion: ${fragment}`);
  }
});

test("post-deploy site-content convergence is bounded and never weakens the approved footer contract", () => {
  assert.match(smoke, /site_content_contract_ready\(\)/);
  assert.match(smoke, /wait_for_site_content\(\)/);
  assert.match(smoke, /for attempt in 1 2 3 4 5 6 7 8/);
  assert.match(smoke, /Cache-Control: no-cache/);
  assert.match(smoke, /smoke_attempt=\$\{attempt\}/);
  assert.match(smoke, /Copyright 2026 a_bags\.handmade All rights reserved/);
  assert.match(smoke, /Full-Stack\/all-in-one Developer: Klaudia Weronika Bartczak/);
  assert.match(smoke, /did not converge to approved production contract after post-deploy retries/);
});
