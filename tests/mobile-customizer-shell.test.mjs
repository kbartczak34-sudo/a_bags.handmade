import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const customizer = fs.readFileSync("app/exact-live-customizer.tsx", "utf8");
const shell = fs.readFileSync("app/bag-builder-mobile-shell-fix.css", "utf8");

test("mobile shell hardening loads after Photo-True styles", () => {
  const photoTrue = customizer.indexOf('import "./bag-builder-photo-true.css"');
  const shellFix = customizer.indexOf('import "./bag-builder-mobile-shell-fix.css"');
  assert.ok(photoTrue >= 0, "Photo-True stylesheet must remain loaded");
  assert.ok(shellFix > photoTrue, "mobile shell fix must load after Photo-True styles");
});

test("open customizer owns the complete mobile viewport and cannot expose storefront underneath", () => {
  assert.match(shell, /body\.abags-vc-open \.abags-vc-layer-root:has\(\.abags-reference-layout-v4\)/);
  assert.match(shell, /position:\s*fixed\s*!important/);
  assert.match(shell, /inset:\s*0\s*!important/);
  assert.match(shell, /background:\s*#fffaf7\s*!important/);
  assert.match(shell, /z-index:\s*2147483000\s*!important/);
  assert.match(shell, /body\.abags-vc-open \.abags-vc-dialog\.abags-reference-layout-v4/);
  assert.match(shell, /height:\s*100%\s*!important/);
  assert.match(shell, /min-height:\s*100%\s*!important/);
});

test("opening the customizer locks storefront scroll and removes floating social controls", () => {
  assert.match(shell, /html:has\(body\.abags-vc-open\)/);
  assert.match(shell, /overflow:\s*hidden\s*!important/);
  assert.match(shell, /overscroll-behavior:\s*none\s*!important/);
  assert.match(shell, /body\.abags-vc-open \.social-quick-links/);
  assert.match(shell, /display:\s*none\s*!important/);
  assert.match(shell, /pointer-events:\s*none\s*!important/);
});

test("customizer content remains internally constrained on mobile", () => {
  assert.match(shell, /\.abags-vc-layout/);
  assert.match(shell, /flex:\s*1 1 0\s*!important/);
  assert.match(shell, /min-height:\s*0\s*!important/);
  assert.match(shell, /overscroll-behavior:\s*contain\s*!important/);
});
