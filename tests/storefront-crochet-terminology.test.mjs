import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const defaults = fs.readFileSync("lib/site-content-shared.ts", "utf8");
const normalizer = fs.readFileSync("lib/site-content.ts", "utf8");
const smoke = fs.readFileSync("scripts/smoke-production.sh", "utf8");
const layout = fs.readFileSync("app/layout.tsx", "utf8");
const manifest = fs.readFileSync("public/manifest.webmanifest", "utf8");
const maskableIcon = fs.readFileSync("public/icon-maskable.svg", "utf8");
const storefront = fs.readFileSync("app/page.tsx", "utf8");
const adminPanel = fs.readFileSync("app/panel/admin-panel.tsx", "utf8");
const siteEditor = fs.readFileSync("app/panel/site-content-editor.tsx", "utf8");

test("storefront defaults describe Agata bags as crocheted rather than woven", () => {
  assert.match(defaults, /title: "Ręcznie szydełkowane"/);
  assert.match(defaults, /imageAlt: "Różowa ręcznie szydełkowana torebka a_bags\.handmade/);
  assert.match(defaults, /imageSublabel: "ręcznie szydełkowana"/);
  assert.match(defaults, /emptyText: "Nowe ręcznie szydełkowane modele/);
  assert.match(defaults, /tagline: "Ręcznie szydełkowane torebki/);
  assert.doesNotMatch(defaults, /Ręcznie plecione|ręcznie pleciona|ręcznie plecione/);
});

test("SEO and PWA metadata use crochet-accurate brand terminology", () => {
  assert.match(layout, /Ręcznie szydełkowane torebki tworzone w Polsce\. Odkryj limitowane modele a_bags\.handmade\./);
  assert.doesNotMatch(layout, /Ręcznie plecione torebki tworzone w Polsce/);
  assert.match(manifest, /"description": "Ręcznie szydełkowane torebki a_bags\.handmade"/);
  assert.doesNotMatch(manifest, /Ręcznie plecione/);
});

test("PWA exposes separate standard and maskable A-Bags icons", () => {
  assert.match(manifest, /"src": "\/favicon\.svg"[\s\S]*?"purpose": "any"/);
  assert.match(manifest, /"src": "\/icon-maskable\.svg"[\s\S]*?"purpose": "maskable"/);
  assert.match(maskableIcon, /<title id="title">Logo a_bags\.handmade<\/title>/);
  assert.match(maskableIcon, /<rect x="64" y="64" width="384" height="384" rx="112"/);
});

test("legacy template wording migrates by exact match without overwriting owner-authored copy", () => {
  const legacyMappings = [
    ["normalized.hero.title", "Ręcznie plecione", "defaultSiteContent.hero.title"],
    ["normalized.hero.imageAlt", "Różowa ręcznie pleciona torebka a_bags.handmade z kwiatową kokardą", "defaultSiteContent.hero.imageAlt"],
    ["normalized.hero.imageSublabel", "ręcznie pleciona", "defaultSiteContent.hero.imageSublabel"],
    ["normalized.collection.emptyText", "Nowe ręcznie plecione modele pojawią się tutaj już wkrótce.", "defaultSiteContent.collection.emptyText"],
    ["normalized.footer.tagline", "Ręcznie plecione torebki, tworzone powoli i z uważnością.", "defaultSiteContent.footer.tagline"],
  ];

  for (const [field, legacy, replacement] of legacyMappings) {
    assert.ok(normalizer.includes(`${field} ===`), `missing exact-match guard for ${field}`);
    assert.ok(normalizer.includes(legacy), `missing legacy value for ${field}`);
    assert.ok(normalizer.includes(`${field} = ${replacement}`), `missing replacement for ${field}`);
  }

  assert.doesNotMatch(normalizer, /\.replace\([^\n]*plecion/i);
  assert.match(normalizer, /Treści zmienione\s*\n\s*\/\/ przez właścicielkę w panelu pozostają zawsze bez zmian\./);
});

test("approved email CTA, review form and footer credit stay in storefront defaults", () => {
  assert.match(defaults, /cta: "Porozmawiajmy o Twojej nowej torebce →"/);
  assert.match(defaults, /formTitle: "Zostaw swoją opinię"/);
  assert.match(defaults, /copyright: "Copyright 2026 a_bags\.handmade All rights reserved"/);
  assert.match(defaults, /statusText: "Full-Stack\/all-in-one Developer: Klaudia Weronika Bartczak"/);
});

test("story and footer email links open a pre-addressed message to the configured mailbox", () => {
  assert.match(storefront, /const contactHref = `mailto:\$\{siteContent\.contact\.email\}\?subject=\$\{encodeURIComponent\(/);
  const uses = storefront.match(/href=\{contactHref\}/g) ?? [];
  assert.ok(uses.length >= 2, "story CTA and footer email should reuse the configured mailto link");
});

test("owner panel exposes whole-site content editing without legacy no-code wording", () => {
  assert.match(siteEditor, /aria-label="Edycja treści całej strony"/);
  assert.match(siteEditor, /Tekst odnośnika e-mail/);
  assert.match(siteEditor, /Tytuł formularza/);
  assert.match(siteEditor, /Prawa autorskie/);
  assert.match(siteEditor, /Dopisek na dole/);
  assert.match(adminPanel, /Ściegi szydełkowe/);
  assert.doesNotMatch(`${adminPanel}\n${siteEditor}`, /Edytuj sklep bez kodu/i);
});

test("production smoke rejects legacy woven copy and verifies approved brand surfaces", () => {
  assert.match(smoke, /\/api\/site-content/);
  assert.match(smoke, /Ręcznie plecione/);
  assert.match(smoke, /Ręcznie szydełkowane/);
  assert.match(smoke, /Porozmawiajmy o Twojej nowej torebce/);
  assert.match(smoke, /Zostaw swoją opinię/);
  assert.match(smoke, /icon-maskable\.svg/);
});
