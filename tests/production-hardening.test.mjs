import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("owner panel is protected by the Worker access gate", () => {
  const worker = read("worker/index.ts");
  assert.match(worker, /pathname === "\/panel"/);
  assert.match(worker, /pathname\.startsWith\("\/panel\/"\)/);
});

test("HTML responses are never cached across privacy-consent states", () => {
  const worker = read("worker/index.ts");
  assert.match(worker, /headers\.set\("Cache-Control", "no-store, max-age=0"\)/);
  assert.match(worker, /appendVary\(headers, "Cookie"\)/);
});

test("storefront publishes baseline browser security headers", () => {
  const worker = read("worker/index.ts");
  assert.match(worker, /Content-Security-Policy/);
  assert.match(worker, /Strict-Transport-Security/);
  assert.match(worker, /X-Frame-Options/);
  assert.match(worker, /X-Content-Type-Options/);
  assert.match(worker, /Permissions-Policy/);
});

test("review submissions are rate limited without storing raw IP addresses", () => {
  const route = read("app/api/reviews/route.ts");
  const reviews = read("lib/reviews.ts");
  assert.match(route, /crypto\.subtle\.digest/);
  assert.match(route, /consumeReviewSubmission/);
  assert.match(route, /status[^\n]*429|,\s*429/);
  assert.match(reviews, /review_rate_limits/);
  assert.match(reviews, /REVIEW_MAX_ATTEMPTS = 5/);
});

test("PWA manifest is scoped for standalone mobile use", () => {
  const manifest = JSON.parse(read("public/manifest.webmanifest"));
  assert.equal(manifest.id, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.orientation, "portrait-primary");
  assert.ok(Array.isArray(manifest.categories) && manifest.categories.includes("shopping"));
});

test("robots and sitemap exist and keep owner routes out of search", () => {
  const robots = read("app/robots.ts");
  const sitemap = read("app/sitemap.ts");
  assert.match(robots, /\/panel/);
  assert.match(robots, /\/site-admin/);
  assert.match(robots, /sitemap\.xml/);
  assert.match(sitemap, /\/regulamin/);
  assert.match(sitemap, /\/polityka-prywatnosci/);
});

test("modal accessibility client traps and restores focus", () => {
  const client = read("app/accessibility-client.tsx");
  const layout = read("app/layout.tsx");
  assert.match(client, /event\.key !== "Tab"/);
  assert.match(client, /restoreTarget\?\.focus/);
  assert.match(client, /aria-modal='true'/);
  assert.match(layout, /<AccessibilityClient \/>/);
});
