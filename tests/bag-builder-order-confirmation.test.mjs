import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const sessionRoute = fs.readFileSync("app/api/checkout/session/route.ts", "utf8");
const successPage = fs.readFileSync("app/zamowienie/sukces/page.tsx", "utf8");

test("checkout confirmation exposes only validated builder project identity", () => {
  assert.match(sessionRoute, /builder_project_code/);
  assert.match(sessionRoute, /\^AB-\[A-Z0-9\]\{7\}\$/);
  assert.match(sessionRoute, /builderProjectCode/);
  assert.match(sessionRoute, /builderProjectReference/);
  assert.match(sessionRoute, /session\.metadata\?\.cart/);
  assert.match(sessionRoute, /slice\(0, 500\)/);
});

test("paid personalized checkout clears the completed builder draft", () => {
  assert.match(successPage, /confirmation\.paymentStatus === "paid"/);
  assert.match(successPage, /confirmation\.paymentStatus === "no_payment_required"/);
  assert.match(successPage, /if \(confirmation\.builderProjectCode\) \{\s*window\.localStorage\.removeItem\("abags-bag-builder-v3"\);\s*\}/);
});

test("processing payment keeps the personalized draft intact", () => {
  assert.match(successPage, /\} else \{\s*setState\(\{ kind: "processing", confirmation \}\);\s*\}/);
  const processingStart = successPage.indexOf('} else {\n          setState({ kind: "processing", confirmation });');
  const catchStart = successPage.indexOf('      } catch (error)', processingStart);
  assert.ok(processingStart > -1 && catchStart > processingStart);
  const processingSection = successPage.slice(processingStart, catchStart);
  assert.doesNotMatch(processingSection, /removeItem\("abags-bag-builder-v3"\)/);
});

test("success screen shows project code and stored specification", () => {
  assert.match(successPage, /Twój projekt A-Bags/);
  assert.match(successPage, /state\.confirmation\.builderProjectCode/);
  assert.match(successPage, /state\.confirmation\.builderProjectReference/);
  assert.match(successPage, /Twój projekt trafia do realizacji zgodnie z zapisaną konfiguracją/);
  assert.match(successPage, /Zachowaj kod/);
});

test("regular cart clearing behavior remains intact", () => {
  assert.match(successPage, /localStorage\.removeItem\("abags-cart"\)/);
});
