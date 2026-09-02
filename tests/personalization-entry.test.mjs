import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const entry = fs.readFileSync("app/personalization-entry.tsx", "utf8");
const layout = fs.readFileSync("app/layout.tsx", "utf8");
const styles = fs.readFileSync("app/personalization-entry.css", "utf8");
const polish = fs.readFileSync("app/visual-customizer-polish.css", "utf8");
const exact = fs.readFileSync("app/exact-live-customizer.tsx", "utf8");
const builder = fs.readFileSync("app/bag-builder-engine.tsx", "utf8");
const builderStyles = fs.readFileSync("app/bag-builder-engine.css", "utf8");
const checkout = fs.readFileSync("app/api/checkout/route.ts", "utf8");
const eslint = fs.readFileSync("eslint.config.mjs", "utf8");

test("personalization is mounted as a prominent storefront feature", () => {
  assert.match(layout, /PersonalizationEntry/);
  assert.match(layout, /ExactLiveCustomizer/);
  assert.match(layout, /bag-builder-engine\.css/);
  assert.match(entry, /id="personalizacja"/);
  assert.match(entry, /Uruchom konfigurator/);
});

test("Bag Builder 3.0 replaces the finished-product photographic chooser", () => {
  assert.match(exact, /bag-builder-engine/);
  assert.match(builder, /A-Bags Atelier · Bag Builder 3\.0/);
  assert.match(builder, /Zbuduj swoją torebkę od podstaw/);
  assert.doesNotMatch(builder, /EXACT_ATELIER_LIBRARY/);
  assert.doesNotMatch(builder, /spriteStyle/);
});

test("builder starts from an empty canvas and adds the silhouette only after choosing a family", () => {
  assert.match(builder, /Wybierz fason/);
  assert.match(builder, /Pusty podgląd konfiguratora/);
  assert.match(builder, /const hasShape = Boolean\(config\.family\)/);
  assert.match(builder, /data-layer="body"/);
  assert.match(builder, /data-builder-key=\{dataKey\}/);
});

test("selected cord color fills the selected shape with a realtime yarn texture", () => {
  assert.match(builder, /Kolor sznurka/);
  assert.match(builder, /abags-yarn-classic/);
  assert.match(builder, /abags-yarn-herringbone/);
  assert.match(builder, /abags-yarn-basket/);
  assert.match(builder, /abags-yarn-shell/);
  assert.match(builder, /fill=\{hasColor \? `url\(#abags-yarn-\$\{stitch\}\)` : "url\(#abags-empty\)"\}/);
  assert.match(builder, /data-color=\{config\.color\}/);
});

test("builder composes independent construction layers in realtime", () => {
  assert.match(builder, /data-layer="strap"/);
  assert.match(builder, /data-layer="handles"/);
  assert.match(builder, /data-layer="flap"/);
  assert.match(builder, /data-layer="hardware"/);
  assert.match(builder, /data-layer="accent"/);
  assert.match(builder, /data-layer="label"/);
  assert.match(builder, /data-builder-signature/);
});

test("builder exposes all requested construction decisions", () => {
  assert.match(builder, /title="Fason"/);
  assert.match(builder, /title="Kolor sznurka"/);
  assert.match(builder, /title="Splot \/ ścieg"/);
  assert.match(builder, /title="Klapa"/);
  assert.match(builder, /title="Uchwyty"/);
  assert.match(builder, /title="Pasek"/);
  assert.match(builder, /title="Okucia"/);
  assert.match(builder, /title="Detal \/ ozdoba"/);
});

test("incompatible wooden handles are removed from round and mini families", () => {
  assert.match(builder, /family === "round" \|\| family === "mini"/);
  assert.match(builder, /current\.handles\.startsWith\("wood-"\)/);
  assert.match(builder, /HANDLES\.filter\(\(item\) => !item\.value\.startsWith\("wood-"\)\)/);
});

test("preview remains beside controls on desktop and sticky above controls on mobile", () => {
  assert.match(builder, /layout\.insertBefore\(target, previewColumn\)/);
  assert.match(builderStyles, /grid-template-columns:minmax\(0,1\.08fr\) minmax\(360px,\.92fr\)/);
  assert.match(builderStyles, /\.abags-vc-preview-column\{order:2;position:sticky;top:0/);
  assert.match(builderStyles, /@media\(max-width:980px\).*\.abags-vc-preview-column\{order:1;position:sticky;top:0/s);
  assert.match(builderStyles, /width:min\(78vw,330px\)/);
});

test("legacy synthetic and photographic preview layers are hidden while Bag Builder is active", () => {
  assert.match(builderStyles, /\.abags-vc-base/);
  assert.match(builderStyles, /\.abags-vc-layer/);
  assert.match(builderStyles, /\.abags-vc-exact-reference/);
  assert.match(builderStyles, /display:none!important/);
  assert.match(builder, /abags-vc-builder-active/);
});

test("project can be saved locally and sent to the workshop without invented pricing", () => {
  assert.match(builder, /abags-bag-builder-v3/);
  assert.match(builder, /localStorage\.setItem/);
  assert.match(builder, /Zapisz projekt/);
  assert.match(builder, /Wyślij projekt do pracowni/);
  assert.match(builder, /Personalizacja jest wyceniana indywidualnie/);
  assert.doesNotMatch(builder, /optionPrice|previewPrice|Orientacyjna cena/);
});

test("legacy entry still keeps product API and exact uploaded atelier assets available outside Builder 3.0", () => {
  assert.match(entry, /\/api\/products/);
  assert.match(entry, /\/api\/customizer-assets\?productId=/);
  assert.match(entry, /asset\.imageUrl/);
  assert.match(entry, /abags-vc-layer/);
  assert.match(styles, /\.abags-vc-layer/);
});

test("stale legacy customizer layers cannot leak between product selections", () => {
  assert.match(entry, /assetsProductId/);
  assert.match(entry, /assetsProductId === config\.productId/);
  assert.match(entry, /currentAssets/);
  assert.doesNotMatch(entry, /setAssetsReady/);
});

test("customizer modal owns its scroll lock and restores keyboard focus", () => {
  assert.match(entry, /abags-vc-open/);
  assert.match(entry, /restoreFocusRef/);
  assert.match(entry, /event\.key !== "Tab"/);
  assert.match(entry, /dialogRef\.current\?\.focus\(\)/);
  assert.match(polish, /body\.abags-vc-open\{overflow:hidden\}/);
});

test("customizer no longer needs a local set-state-in-effect lint exception", () => {
  assert.doesNotMatch(eslint, /files:\s*\["app\/personalization-entry\.tsx"\]/);
});

test("desktop and mobile navigation receive personalization entry", () => {
  assert.match(entry, /desktop-navigation/);
  assert.match(entry, /mobile-navigation/);
  assert.match(entry, /data-abags-personalize-link/);
  assert.match(styles, /abags-personalize-nav-link/);
});

test("Bag Builder does not duplicate checkout and Stripe payment methods stay untouched", () => {
  assert.doesNotMatch(builder, /api\/checkout/);
  assert.match(checkout, /payment_method_types/);
});

test("Bag Builder has responsive mobile styles", () => {
  assert.match(builderStyles, /@media\(max-width:980px\)/);
  assert.match(builderStyles, /@media\(max-width:620px\)/);
  assert.match(builderStyles, /@media\(max-width:420px\)/);
});
