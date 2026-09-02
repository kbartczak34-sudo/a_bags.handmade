import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const experience = fs.readFileSync("app/storefront-experience.tsx", "utf8");
const layout = fs.readFileSync("app/layout.tsx", "utf8");
const success = fs.readFileSync("app/zamowienie/sukces/page.tsx", "utf8");
const admin = fs.readFileSync("app/panel/admin-panel.tsx", "utf8");
const dashboard = fs.readFileSync("app/panel/business-dashboard.tsx", "utf8");
const contactManager = fs.readFileSync("app/panel/contact-social-manager.tsx", "utf8");
const contactHook = fs.readFileSync("app/public-contact.ts", "utf8");
const shared = fs.readFileSync("lib/site-content-shared.ts", "utf8");
const siteContent = fs.readFileSync("lib/site-content.ts", "utf8");

test("storefront mounts premium shopping experience", () => {
  assert.match(layout, /StorefrontExperience/);
  assert.match(layout, /storefront-experience\.css/);
});

test("experience includes wishlist, quiz, configurator and managed WhatsApp flow", () => {
  assert.match(experience, /abags-wishlist/);
  assert.match(experience, /Znajdź swoją A-Bags/);
  assert.match(experience, /Stwórz swoją torebkę/);
  assert.match(experience, /usePublicContact/);
  assert.match(experience, /whatsappHref\(contact\.whatsappNumber/);
  assert.match(experience, /Zapytaj o termin na WhatsApp/);
  assert.match(experience, /Zapytaj o ponowne wykonanie na WhatsApp/);
});

test("experience includes lookbook and truthful availability without invented stock counts", () => {
  assert.match(experience, /A-Bags w Twoim stylu/);
  assert.match(experience, /Poznaj sploty A-Bags/);
  assert.match(experience, /Dostępna od ręki/);
  assert.match(experience, /Na zamówienie/);
  assert.match(experience, /Chwilowo niedostępna/);
  assert.match(experience, /availabilityNote/);
  assert.doesNotMatch(experience, /została 1 sztuka/i);
  assert.doesNotMatch(experience, /<span>Mała seria<\/span>/);
});

test("post-purchase page gives next steps and managed contact routes", () => {
  assert.match(success, /Twoja A-Bags jest coraz bliżej Ciebie/);
  assert.match(success, /Co wydarzy się dalej/);
  assert.match(success, /Napisz do nas na WhatsApp/);
  assert.match(success, /contact\.instagramUrl/);
  assert.match(success, /contact\.facebookUrl/);
});

test("owner panel exposes business dashboard and contact settings", () => {
  assert.match(admin, /BusinessDashboard/);
  assert.match(dashboard, /Sklep w liczbach/);
  assert.match(dashboard, /Przychód/);
  assert.match(dashboard, /W realizacji/);
  assert.match(admin, /Kontakt i social media/);
  assert.match(admin, /ContactSocialManager/);
  assert.match(contactManager, /Numer WhatsApp/);
  assert.match(contactManager, /Facebook/);
  assert.match(contactManager, /Instagram/);
});

test("contact settings are validated centrally and exposed through one public hook", () => {
  assert.match(shared, /whatsappNumber/);
  assert.match(shared, /facebookUrl/);
  assert.match(siteContent, /readWhatsAppNumber/);
  assert.match(siteContent, /readSocialUrl/);
  assert.match(contactHook, /\/api\/site-content/);
  assert.match(contactHook, /whatsappHref/);
  assert.doesNotMatch(layout, /48504510200/);
  assert.doesNotMatch(experience, /48504510200/);
  assert.doesNotMatch(success, /48504510200/);
});
