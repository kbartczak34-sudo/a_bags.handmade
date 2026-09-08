import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workflow = fs.readFileSync(".github/workflows/deploy-cloudflare.yml", "utf8");

test("regression diagnostics observe the real test outcome", () => {
  assert.match(workflow, /npm run test:regression 2>&1 \| tee regression-tests\.log/);
  assert.match(workflow, /status=\$\{PIPESTATUS\[0\]\}/);
  assert.match(workflow, /echo "exit_code=\$\{status\}" >> "\$GITHUB_OUTPUT"/);
  assert.match(workflow, /exit "\$status"/);
  assert.match(workflow, /continue-on-error: true/);
  assert.match(workflow, /if: steps\.regression\.outcome == 'failure'/);
});

test("regression failure still reaches an explicit blocking gate", () => {
  assert.match(workflow, /- name: Fail regression gate/);
  assert.match(workflow, /if: steps\.regression\.outcome == 'failure'/);
  assert.match(workflow, /Regression tests failed\./);
});
