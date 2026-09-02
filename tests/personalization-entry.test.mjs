import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const entry = fs.readFileSync("app/personalization-entry.tsx", "utf8");
const layout = fs.readFileSync("app/layout.tsx", "utf8");
const styles = fs.readFileSync("app/personalization-entry.css", "utf8");
const polish = fs.readFileSync("app/visual-customizer-polish.css", "utf8");
const checkout = fs.readFileSync("app/api/checkout/route.ts", "utf8");

test("personalization is mounted as a prominent storefront feature", () => {
  assert.match(layout, /PersonalizationEntry/);
  assert.match(layout, /personalization-entry\.css/);
  assert.match(layout, /visual-customizer-polish\.css/);
  assert.match(entry, /id="personalizacja"/);
  assert.match(entry, /Uruchom konfigurator/);
  assert.match(entry, /A-Bags Visual Customizer 2\.0/);
});

test("visual customizer exposes all configuration dimensions", () => {
  assert.match(entry, /Model bazowy/);
  assert.match(entry, /Kolor/);
  assert.match(entry, /Splot \/ ścieg/);
  assert.match(entry, /Uchwyty/);
  assert.match(entry, /Okucia/);
  assert.match(entry, /Pasek/);
  assert.match(entry, /Detal \/ ozdoba/);
});

test("visual customizer preserves the real product as the base layer", () => {
  assert.match(entry, /abags-vc-base/);
  assert.match(entry, /product\.imageUrl/);
  assert.match(entry, /\/images\/configurator\//);
  assert.match(entry, /abags-vc-layer/);
  assert.match(styles, /\.abags-vc-base/);
  assert.match(styles, /\.abags-vc-layer/);
  assert.match(entry, /onError=\{\(\) => setVisible\(false\)\}/);
});

test("customer can compare personalization with the untouched base product", () => {
  assert.match(entry, /Porównaj z bazą/);
  assert.match(entry, /Pokaż projekt/);
  assert.match(entry, /Widok bazowy/);
  assert.match(polish, /abags-vc-compare/);
});

test("configuration updates locally and can be restored safely", () => {
  assert.match(entry, /abags-customizer-draft-v2/);
  assert.match(entry, /localStorage\.setItem/);
  assert.match(entry, /localStorage\.getItem/);
  assert.match(entry, /sanitizeConfig/);
  assert.match(entry, /Zapisz projekt/);
});

test("desktop and mobile navigation receive personalization entry", () => {
  assert.match(entry, /desktop-navigation/);
  assert.match(entry, /mobile-navigation/);
  assert.match(entry, /data-abags-personalize-link/);
  assert.match(styles, /abags-personalize-nav-link/);
});

test("customizer reuses product API and existing contact handoff without duplicating checkout", () => {
  assert.match(entry, /\/api\/products/);
  assert.match(entry, /whatsappHref/);
  assert.doesNotMatch(entry, /api\/checkout/);
  assert.match(checkout, /payment_method_types/);
});

test("visual customizer has responsive dialog styles", () => {
  assert.match(styles, /abags-vc-dialog/);
  assert.match(styles, /@media\(max-width:980px\)/);
  assert.match(styles, /@media\(max-width:620px\)/);
});
