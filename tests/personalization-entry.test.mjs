import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const entry = fs.readFileSync("app/personalization-entry.tsx", "utf8");
const layout = fs.readFileSync("app/layout.tsx", "utf8");
const styles = fs.readFileSync("app/personalization-entry.css", "utf8");
const polish = fs.readFileSync("app/visual-customizer-polish.css", "utf8");
const checkout = fs.readFileSync("app/api/checkout/route.ts", "utf8");
const eslint = fs.readFileSync("eslint.config.mjs", "utf8");

test("personalization is mounted as a prominent storefront feature", () => {
  assert.match(layout, /PersonalizationEntry/);
  assert.match(layout, /personalization-entry\.css/);
  assert.match(layout, /visual-customizer-polish\.css/);
  assert.match(entry, /id="personalizacja"/);
  assert.match(entry, /Uruchom konfigurator/);
  assert.match(entry, /A-Bags Visual Customizer 2\.1/);
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

test("visual customizer preserves the real product as the base layer and uses live asset manifest", () => {
  assert.match(entry, /abags-vc-base/);
  assert.match(entry, /product\.imageUrl/);
  assert.match(entry, /\/api\/customizer-assets\?productId=/);
  assert.match(entry, /asset\.imageUrl/);
  assert.match(entry, /abags-vc-layer/);
  assert.match(styles, /\.abags-vc-base/);
  assert.match(styles, /\.abags-vc-layer/);
  assert.match(entry, /onError=\{\(\) => setVisible\(false\)\}/);
});

test("zero-asset mode visualizes choices immediately and exact atelier layers stay preferred", () => {
  assert.match(polish, /Automatic zero-asset preview/);
  assert.match(polish, /--vc-auto-color/);
  assert.match(polish, /mix-blend-mode:color/);
  assert.match(polish, /--vc-hardware/);
  assert.match(polish, /--vc-strap/);
  assert.match(polish, /--vc-accent/);
  assert.match(polish, /podgląd auto/);
  assert.match(polish, /podgląd dokładny ✓/);
  assert.match(entry, /Dokładne warstwy atelier mają pierwszeństwo/);
  assert.match(polish, /\.abags-vc-layer\{z-index:5\}/);
  assert.match(entry, /hasAutoPreview/);
  assert.match(entry, /Podgląd automatyczny/);
});

test("customer sees automatic preview and exact-layer availability honestly", () => {
  assert.match(entry, /podgląd dokładny ✓/);
  assert.match(entry, /podgląd auto/);
  assert.match(entry, /Wybierz wariant/);
  assert.match(entry, /hasLiveLayers/);
  assert.match(entry, /hasAutoPreview/);
  assert.match(entry, /Zmiany są widoczne natychmiast/);
});

test("stale customizer layers cannot leak between product selections", () => {
  assert.match(entry, /assetsProductId/);
  assert.match(entry, /assetsProductId === config\.productId/);
  assert.match(entry, /currentAssets/);
  assert.match(entry, /asset\.productId\.toLowerCase\(\) === config\.productId\.toLowerCase\(\)/);
  assert.doesNotMatch(entry, /setAssetsReady/);
});

test("customizer modal owns its scroll lock and restores keyboard focus", () => {
  assert.match(entry, /abags-vc-open/);
  assert.match(entry, /restoreFocusRef/);
  assert.match(entry, /event\.key !== "Tab"/);
  assert.match(entry, /dialogRef\.current\?\.focus\(\)/);
  assert.match(polish, /body\.abags-vc-open\{overflow:hidden\}/);
  assert.doesNotMatch(entry, /classList\.toggle\("modal-open"/);
});

test("customizer no longer needs a local set-state-in-effect lint exception", () => {
  assert.doesNotMatch(eslint, /files:\s*\["app\/personalization-entry\.tsx"\]/);
});

test("customizer never invents personalization surcharges", () => {
  assert.match(entry, /Cena modelu bazowego/);
  assert.match(entry, /Personalizacja jest wyceniana indywidualnie po potwierdzeniu konfiguracji/);
  assert.doesNotMatch(entry, /Orientacyjna cena/);
  assert.doesNotMatch(entry, /optionPrice|previewPrice/);
  assert.doesNotMatch(entry, /price:\s*(15|20|25|35|40)/);
  assert.match(entry, /finalnej ceny i terminu/);
});

test("customer can compare personalization with the untouched base product", () => {
  assert.match(entry, /Porównaj z bazą/);
  assert.match(entry, /Pokaż projekt/);
  assert.match(entry, /Widok bazowy/);
  assert.match(polish, /abags-vc-compare/);
  assert.match(polish, /is-showing-base/);
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
