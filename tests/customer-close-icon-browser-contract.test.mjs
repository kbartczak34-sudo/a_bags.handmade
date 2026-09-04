import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const controller = readFileSync("app/bag-builder-customer-close-icon.tsx", "utf8");
const css = readFileSync("app/bag-builder-customer-premium-polish.css", "utf8");
const live = readFileSync("app/exact-live-customizer.tsx", "utf8");

test("customer close SVG targets only the real close button and preserves accessibility", () => {
  assert.match(controller, /button\[aria-label="Zamknij"\]/);
  assert.match(controller, /aria-hidden/);
  assert.match(controller, /focusable/);
  assert.match(controller, /data-abags-customer-close-svg/);
  assert.match(controller, /appendChild\(createCloseSvg\(\)\)/);
  assert.doesNotMatch(controller, /replaceChildren/);
});

test("customer close SVG remains isolated from mobile and Photo-True", () => {
  assert.match(controller, /matchMedia\("\(min-width: 981px\)"\)/);
  assert.match(controller, /abagsPhotoTrue !== "active"/);
  assert.match(css, /@media\(min-width:981px\)/);
  assert.doesNotMatch(css, /data:image\/svg\+xml/);
});

test("customer close controller mounts after Reference V4", () => {
  assert.match(live, /<BagBuilderReferenceV4 \/>[\s\S]*?<BagBuilderCustomerCloseIcon \/>/);
});
