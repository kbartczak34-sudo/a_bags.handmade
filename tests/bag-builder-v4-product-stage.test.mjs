import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const stack = fs.readFileSync("app/exact-live-customizer.tsx", "utf8");
const stage = fs.readFileSync("app/bag-builder-reference-v4-product-stage.css", "utf8");

test("V4 product-stage cleanup is loaded after the final compatibility stylesheet", () => {
  const finalCss = stack.indexOf('import "./bag-builder-reference-v4-final.css"');
  const stageCss = stack.indexOf('import "./bag-builder-reference-v4-product-stage.css"');
  assert.ok(finalCss > -1);
  assert.ok(stageCss > finalCss);
});

test("legacy CSS atelier scenery cannot remain behind the premium product", () => {
  assert.match(stage, /abags-canvas3d-active::before/);
  assert.match(stage, /abags-canvas3d-active::after/);
  assert.match(stage, /content:none!important/);
  assert.match(stage, /display:none!important/);
});

test("final V4 stage uses a quiet product-first background and softer premium canvas filtering", () => {
  assert.match(stage, /linear-gradient\(180deg,#f8eee5 0 66%,#ead5c1 66% 100%\)/);
  assert.match(stage, /abags-premium-canvas3d-canvas/);
  assert.match(stage, /saturate\(\.97\) contrast\(\.92\) brightness\(1\.025\)/);
});
