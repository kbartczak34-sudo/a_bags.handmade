import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const controller = readFileSync("app/bag-builder-customer-close-icon.tsx", "utf8");
const css = readFileSync("app/bag-builder-customer-premium-polish.css", "utf8");
const live = readFileSync("app/exact-live-customizer.tsx", "utf8");

test("customer close v2 targets only the real close button and preserves accessibility", () => {
  assert.match(controller, /button\[aria-label="Zamknij"\]/);
  assert.match(controller, /data-abags-customer-close-surface/);
  assert.match(controller, /aria-hidden/);
  assert.match(controller, /createStroke\("45deg"\)/);
  assert.match(controller, /createStroke\("-45deg"\)/);
  assert.doesNotMatch(controller, /replaceChildren/);
  assert.doesNotMatch(controller, /textContent\s*=/);
});

test("customer close controller targets the actual V4 dialog used by production QA", () => {
  assert.match(controller, /const DIALOG_SELECTOR = "\.abags-vc-dialog\.abags-reference-layout-v4"/);
  assert.doesNotMatch(controller, /abags-vc-builder-active/);
});

test("customer close v2 is independent from fonts and SVG styling", () => {
  assert.match(controller, /data-abags-customer-close-icon="lines-v2"/);
  assert.match(controller, /setImportant\(button, "font-size", "0"\)/);
  assert.match(controller, /setImportant\(line, "background", "#674d53"\)/);
  assert.match(controller, /setImportant\(line, "transform", `translate\(-50%, -50%\) rotate\(\$\{angle\}\)`\)/);
  assert.doesNotMatch(controller, /createElementNS/);
  assert.doesNotMatch(controller, /currentColor/);
});

test("customer close evaluates the live viewport instead of a stale MediaQueryList", () => {
  assert.match(controller, /function isDesktopViewport\(\)[\s\S]*window\.innerWidth >= 981/);
  assert.match(controller, /const desktop = isDesktopViewport\(\)/);
  assert.match(controller, /window\.addEventListener\("resize", requestSync\)/);
  assert.match(controller, /window\.removeEventListener\("resize", requestSync\)/);
  assert.doesNotMatch(controller, /matchMedia/);
  assert.doesNotMatch(controller, /desktop\.matches/);
});

test("customer close v2 restores inline styles and remains isolated from Photo-True", () => {
  assert.match(controller, /abagsPhotoTrue !== "active"/);
  assert.match(controller, /savedStyles/);
  assert.match(controller, /button\.style\.setProperty\(property, state\.value, state\.priority\)/);
  assert.match(controller, /button\.style\.removeProperty\(property\)/);
  assert.match(css, /@media\(min-width:981px\)/);
  assert.doesNotMatch(css, /data:image\/svg\+xml/);
});

test("customer close controller mounts after Reference V4", () => {
  assert.match(live, /<BagBuilderReferenceV4 \/>[\s\S]*?<BagBuilderCustomerCloseIcon \/>/);
});
