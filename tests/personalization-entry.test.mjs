import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const entry = fs.readFileSync("app/personalization-entry.tsx", "utf8");
const layout = fs.readFileSync("app/layout.tsx", "utf8");
const styles = fs.readFileSync("app/personalization-entry.css", "utf8");
const checkout = fs.readFileSync("app/api/checkout/route.ts", "utf8");

test("personalization is mounted as a prominent storefront feature", () => {
  assert.match(layout, /PersonalizationEntry/);
  assert.match(layout, /personalization-entry\.css/);
  assert.match(entry, /id="personalizacja"/);
  assert.match(entry, /Personalizuj torebkę/);
  assert.match(entry, /Stwórz torebkę dokładnie po swojemu/);
});

test("personalization exposes all five configuration dimensions", () => {
  assert.match(entry, /Model bazowy/);
  assert.match(entry, /Kolor/);
  assert.match(entry, /Splot \/ ścieg/);
  assert.match(entry, /Uchwyty/);
  assert.match(entry, /Detal/);
});

test("desktop and mobile navigation receive a personalization entry", () => {
  assert.match(entry, /desktop-navigation/);
  assert.match(entry, /mobile-navigation/);
  assert.match(entry, /data-abags-personalize-link/);
  assert.match(styles, /abags-personalize-nav-link/);
});

test("entry reuses existing configurator instead of duplicating checkout logic", () => {
  assert.match(entry, /Stwórz własną torebkę/);
  assert.doesNotMatch(entry, /api\/checkout/);
  assert.match(checkout, /payment_method_types/);
});
