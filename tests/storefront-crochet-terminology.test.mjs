import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const defaults = fs.readFileSync("lib/site-content-shared.ts", "utf8");
const normalizer = fs.readFileSync("lib/site-content.ts", "utf8");
const smoke = fs.readFileSync("scripts/smoke-production.sh", "utf8");

test("storefront defaults describe Agata bags as crocheted rather than woven", () => {
  assert.match(defaults, /title: "Ręcznie szydełkowane"/);
  assert.match(defaults, /imageAlt: "Różowa ręcznie szydełkowana torebka a_bags\.handmade/);
  assert.match(defaults, /imageSublabel: "ręcznie szydełkowana"/);
  assert.match(defaults, /emptyText: "Nowe ręcznie szydełkowane modele/);
  assert.match(defaults, /tagline: "Ręcznie szydełkowane torebki/);
  assert.doesNotMatch(defaults, /Ręcznie plecione|ręcznie pleciona|ręcznie plecione/);
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

test("production smoke rejects the legacy woven storefront copy", () => {
  assert.match(smoke, /\/api\/site-content/);
  assert.match(smoke, /Ręcznie plecione/);
  assert.match(smoke, /Ręcznie szydełkowane/);
});
