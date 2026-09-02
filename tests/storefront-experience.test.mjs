import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const experience = fs.readFileSync("app/storefront-experience.tsx", "utf8");
const layout = fs.readFileSync("app/layout.tsx", "utf8");
const success = fs.readFileSync("app/zamowienie/sukces/page.tsx", "utf8");
const admin = fs.readFileSync("app/panel/admin-panel.tsx", "utf8");
const dashboard = fs.readFileSync("app/panel/business-dashboard.tsx", "utf8");

test("storefront mounts premium shopping experience", () => {
  assert.match(layout, /StorefrontExperience/);
  assert.match(layout, /storefront-experience\.css/);
});

test("experience includes wishlist, quiz, configurator and direct WhatsApp flow", () => {
  assert.match(experience, /abags-wishlist/);
  assert.match(experience, /Znajdź swoją A-Bags/);
  assert.match(experience, /Stwórz swoją torebkę/);
  assert.match(experience, /wa\.me\/\$\{WHATSAPP_NUMBER\}/);
  assert.match(experience, /Zapytaj o dostępność na WhatsApp/);
});

test("experience includes lookbook and stitch lexicon without inventing stock counts", () => {
  assert.match(experience, /A-Bags w Twoim stylu/);
  assert.match(experience, /Poznaj sploty A-Bags/);
  assert.match(experience, /Mała seria/);
  assert.doesNotMatch(experience, /została 1 sztuka/i);
});

test("post-purchase page gives next steps and contact routes", () => {
  assert.match(success, /Twoja A-Bags jest coraz bliżej Ciebie/);
  assert.match(success, /Co wydarzy się dalej/);
  assert.match(success, /Napisz do nas na WhatsApp/);
});

test("owner panel exposes business dashboard", () => {
  assert.match(admin, /BusinessDashboard/);
  assert.match(dashboard, /Sklep w liczbach/);
  assert.match(dashboard, /Przychód/);
  assert.match(dashboard, /W realizacji/);
});
