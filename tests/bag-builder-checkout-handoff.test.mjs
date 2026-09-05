import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const settings = fs.readFileSync("lib/bag-builder-settings.ts", "utf8");
const manager = fs.readFileSync("app/panel/bag-builder-settings-manager.tsx", "utf8");
const endpoint = fs.readFileSync("app/api/bag-builder-checkout/route.ts", "utf8");
const handoff = fs.readFileSync("app/bag-builder-checkout-handoff.tsx", "utf8");
const exact = fs.readFileSync("app/exact-live-customizer.tsx", "utf8");
const orders = fs.readFileSync("app/panel/orders-manager.tsx", "utf8");

test("legacy builder families can still map to real catalog products as fallback", () => {
  assert.match(settings, /familyProductIds: Record<BuilderFamily, string \| null>/);
  assert.match(settings, /familyProductIds: \{ tote: null, round: null, bucket: null, mini: null \}/);
  assert.match(manager, /Produkt bazowy do bezpiecznej sprzedaży/);
  assert.match(manager, /Nie przypisano — tylko konsultacja/);
  assert.match(manager, /\/api\/products/);
});

test("server validates project options, Agata fidelity, settings compatibility and the photographed base product", () => {
  assert.match(endpoint, /normalizeBagBuilderProjectConfig/);
  assert.match(endpoint, /getBagBuilderSettings/);
  assert.match(endpoint, /isBagBuilderProjectCompatible/);
  assert.match(settings, /isAgataBuilderConstructionSupported/);
  assert.match(settings, /isAgataBuilderConstructionSupported\(config\.family, "handles", config\.handles\)/);
  assert.match(settings, /isAgataBuilderConstructionSupported\(config\.family, "straps", config\.strap\)/);
  assert.match(settings, /isAgataBuilderConstructionSupported\(config\.family, "flaps", config\.flap\)/);
  assert.match(settings, /isAgataBuilderConstructionSupported\(config\.family, "accents", config\.accent\)/);
  assert.match(endpoint, /builder_incompatible/);
  assert.match(endpoint, /requestedBaseProductId/);
  assert.match(endpoint, /photoBaseProductId \|\| settings\.familyProductIds\[config\.family\]/);
  assert.match(endpoint, /findVisibleProductsByIds\(\[productId\]\)/);
  assert.match(endpoint, /productComplianceComplete\(baseProduct\)/);
});

test("photo-true price uses the actual catalog base and server-side configured extras", () => {
  assert.match(endpoint, /baseProduct\.unitAmount \+ personalizationCents\(config, settings\)/);
  assert.match(endpoint, /calculateBagBuilderProjectCents\(config, settings\)/);
  assert.match(endpoint, /unit_amount.*String\(projectAmount\)/);
  assert.doesNotMatch(endpoint, /raw\.price|source\.price|config\.price|clientPrice|requestedPrice/);
  assert.match(handoff, /baseProductId: stage\.dataset\.photoProductId/);
  assert.match(handoff, /body: JSON\.stringify\(\{ config: projectConfig, baseProductId: baseProductId \|\| undefined \}\)/);
  assert.doesNotMatch(handoff, /body: JSON\.stringify\(\{[^}]*price/);
});

test("checkout preserves existing Stripe live and webhook safeguards", () => {
  assert.match(endpoint, /detectStripeKeyMode/);
  assert.match(endpoint, /getStripeSecretKey/);
  assert.match(endpoint, /isStripeLiveWebhookReady/);
  assert.match(endpoint, /stripe_live_required/);
  assert.match(endpoint, /stripe_live_webhook_required/);
  assert.match(endpoint, /abags-payment-method=\(blik\|card\|wallet\)/);
});

test("project identity, photo base and material survive Stripe checkout into the order record", () => {
  assert.match(endpoint, /bagBuilderProjectCode/);
  assert.match(endpoint, /bagBuilderProjectSummary/);
  assert.match(endpoint, /Sznurek poliestrowy z Pimiotki/);
  assert.match(endpoint, /baza fotograficzna 1:1/);
  assert.match(endpoint, /metadata\[cart\]/);
  assert.match(endpoint, /metadata\[builder_project_code\]/);
  assert.match(endpoint, /metadata\[builder_project_config\]/);
  assert.match(endpoint, /metadata\[builder_catalog_id\]/);
  assert.match(endpoint, /metadata\[builder_photo_true\]/);
  assert.match(endpoint, /payment_intent_data\[metadata\]\[builder_project_code\]/);
  assert.match(orders, /Pozycje \/ projekt:/);
  assert.match(orders, /order\.cartReference/);
});

test("server order summary uses the same Agata family and crochet-stitch vocabulary as the customer builder", () => {
  assert.match(settings, /tote: "Kuferek \/ tote"/);
  assert.match(settings, /round: "Okrągła"/);
  assert.match(settings, /bucket: "Z klapą"/);
  assert.match(settings, /mini: "Strukturalna \/ mini"/);
  assert.match(settings, /classic: "Ażurowy V"/);
  assert.match(settings, /herringbone: "Pionowy ażurowy"/);
  assert.match(settings, /basket: "Koszykowy"/);
  assert.match(settings, /shell: "Promienisty"/);
  assert.doesNotMatch(settings, /tote: "Prostokątna"|round: "Półokrągła"|bucket: "Kubełkowa"/);
});

test("active builder mounts secure checkout without replacing the regular cart", () => {
  assert.match(exact, /BagBuilderCheckoutHandoff/);
  assert.match(exact, /<BagBuilderCheckoutHandoff \/>/);
  assert.match(handoff, /\/api\/bag-builder-checkout/);
  assert.match(handoff, /Kup ten projekt/);
  assert.match(handoff, /rzeczywistej ceny katalogowej|Cena bazowa pochodzi z katalogu sklepu/);
  assert.doesNotMatch(handoff, /abags-cart/);
});