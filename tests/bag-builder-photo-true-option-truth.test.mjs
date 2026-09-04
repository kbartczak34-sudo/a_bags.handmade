import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const truth = fs.readFileSync("app/bag-builder-photo-true-option-truth.tsx", "utf8");
const styles = fs.readFileSync("app/bag-builder-photo-true-option-truth.css", "utf8");
const mount = fs.readFileSync("app/exact-live-customizer.tsx", "utf8");

test("truth layer runs after Photo-True and its structural flow guard", () => {
  assert.match(mount, /<BagBuilderPhotoTrue \/>\s*<BagBuilderPhotoTrueFlowGuard \/>\s*<BagBuilderPhotoTrueOptionTruth \/>/);
  assert.match(mount, /import "\.\/bag-builder-photo-true-option-truth\.css"/);
});

test("no-change optional choices are treated as the photographic base, not missing overlays", () => {
  for (const value of ["flap:none", "handles:none", "strap:none", "accent:none"]) {
    assert.match(truth, new RegExp(value));
  }
  assert.match(truth, /const status = isBase \? "base" : isExact \? "exact" : "written"/);
});

test("preview fidelity is explicit without claiming manufacturability", () => {
  assert.match(truth, /button\.dataset\.photoPreviewLabel = status === "base" \? "BAZA" : status === "exact" \? "1:1" : "BEZ 1:1"/);
  assert.match(truth, /Wariant zostanie zapisany w projekcie/);
  assert.match(truth, /Zdjęcie nie będzie sztucznie domalowywane/);
  assert.doesNotMatch(truth, /niedostępn|niemożliw|nie można wykonać/i);
});

test("option fidelity is available to sighted and assistive-technology users", () => {
  assert.match(truth, /setAttribute\("aria-label"/);
  assert.match(truth, /button\.title = description/);
  assert.match(styles, /content:attr\(data-photo-preview-label\)/);
  assert.match(styles, /data-photo-preview-status="written"/);
  assert.match(styles, /border-style:dashed!important/);
});

test("written-only variants stay selectable and fully legible", () => {
  const writtenRule = styles.match(/button\[data-photo-preview-status="written"\]\{([^}]*)\}/s)?.[1] ?? "";
  assert.match(writtenRule, /opacity:1!important/);
  assert.match(writtenRule, /border-style:dashed!important/);
  assert.doesNotMatch(writtenRule, /pointer-events\s*:\s*none/);
  assert.doesNotMatch(truth, /disabled\s*=/);

  // The decorative badge itself must not intercept taps; this does not disable the button.
  assert.match(styles, /button\[data-photo-preview-status\]::after\{[\s\S]*?pointer-events:none;[\s\S]*?\}/);
});
