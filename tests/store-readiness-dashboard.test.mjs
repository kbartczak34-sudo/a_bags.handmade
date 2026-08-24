import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("admin status endpoint is protected and never exposes secret values", () => {
  const route = read("app/api/admin/status/route.ts");
  assert.match(route, /isAdminRequest\(request\)/);
  assert.match(route, /Cache-Control/);
  assert.match(route, /stripeReady/);
  assert.match(route, /webhookReady/);
  assert.match(route, /emailReady/);
  assert.doesNotMatch(route, /STRIPE_SECRET_KEY:\s*env\.STRIPE_SECRET_KEY/);
  assert.doesNotMatch(route, /RESEND_API_KEY:\s*env\.RESEND_API_KEY/);
});

test("owner dashboard opens on store readiness status", () => {
  const panel = read("app/panel/admin-panel.tsx");
  assert.match(panel, /type AdminTab = "status"/);
  assert.match(panel, /useState<AdminTab>\("status"\)/);
  assert.match(panel, /<StoreStatus \/>/);
  assert.match(panel, /Status sklepu/);
});

test("store readiness view reports infrastructure and legal blockers", () => {
  const view = read("app/panel/store-status.tsx");
  assert.match(view, /\/api\/admin\/status/);
  assert.match(view, /Baza D1/);
  assert.match(view, /Magazyn R2/);
  assert.match(view, /Webhook Stripe/);
  assert.match(view, /E-maile transakcyjne/);
  assert.match(view, /readinessIssues/);
  assert.match(view, /fail-closed/);
});
