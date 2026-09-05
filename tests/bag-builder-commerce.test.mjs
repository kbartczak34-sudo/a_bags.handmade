import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const settings = fs.readFileSync("lib/bag-builder-settings.ts", "utf8");
const commerce = fs.readFileSync("app/bag-builder-commerce.tsx", "utf8");
const admin = fs.readFileSync("app/panel/bag-builder-settings-manager.tsx", "utf8");
const panel = fs.readFileSync("app/panel/admin-panel.tsx", "utf8");
const exact = fs.readFileSync("app/exact-live-customizer.tsx", "utf8");
const layout = fs.readFileSync("app/layout.tsx", "utf8");
const publicRoute = fs.readFileSync("app/api/bag-builder-settings/route.ts", "utf8");
const adminRoute = fs.readFileSync("app/api/admin/bag-builder-settings/route.ts", "utf8");

test("Bag Builder pricing is fail-safe until owner enables real prices", () => {
  assert.match(settings, /pricingEnabled:\s*false/);
  assert.match(settings, /familyBaseCents:\s*\{ tote: null, round: null, bucket: null, mini: null \}/);
  assert.match(commerce, /Wycena indywidualna/);
  assert.doesNotMatch(settings, /familyBaseCents:\s*\{[^}]*[1-9]\d{3}/);
});

test("Bag Builder settings persist in the existing D1 database", () => {
  assert.match(settings, /getProductDb/);
  assert.match(settings, /CREATE TABLE IF NOT EXISTS bag_builder_settings/);
  assert.match(settings, /ON CONFLICT\(id\) DO UPDATE/);
  assert.match(publicRoute, /getBagBuilderSettings/);
  assert.match(adminRoute, /isAdminRequest/);
  assert.match(adminRoute, /saveBagBuilderSettings/);
});

test("compatibility rules actively disable impossible builder options", () => {
  assert.match(settings, /round:\s*\["none", "crochet"\]/);
  assert.match(settings, /mini:\s*\["none", "crochet"\]/);
  assert.match(commerce, /is-incompatible/);
  assert.match(commerce, /button\.disabled = !compatible/);
  assert.match(commerce, /data-builder-value="none"/);
});

test("live price composes base price with selected option modifiers", () => {
  assert.match(commerce, /familyBaseCents/);
  assert.match(commerce, /stitchCents/);
  assert.match(commerce, /flapCents/);
  assert.match(commerce, /handlesCents/);
  assert.match(commerce, /strapCents/);
  assert.match(commerce, /hardwareCents/);
  assert.match(commerce, /accentCents/);
  assert.match(commerce, /data-builder-live-price/);
  assert.match(commerce, /Cena projektu/);
});

test("customer price breakdown uses the Agata family and crochet-stitch vocabulary", () => {
  assert.match(commerce, /tote: "Kuferek \/ tote"/);
  assert.match(commerce, /round: "Okrągła"/);
  assert.match(commerce, /bucket: "Z klapą"/);
  assert.match(commerce, /mini: "Strukturalna \/ mini"/);
  assert.match(commerce, /classic: "Ażurowy V"/);
  assert.match(commerce, /herringbone: "Pionowy ażurowy"/);
  assert.match(commerce, /shell: "Promienisty"/);
  assert.match(commerce, /Ścieg szydełkowy ·/);
  assert.doesNotMatch(commerce, /Splot ·/);
});

test("owner can configure Bag Builder pricing without code changes using the same Agata terminology", () => {
  assert.match(admin, /Włącz cenę na żywo/);
  assert.match(admin, /Cena bazowa fasonu/);
  assert.match(admin, /Dopłaty do opcji/);
  assert.match(admin, /tote: "Kuferek \/ tote"/);
  assert.match(admin, /round: "Okrągła"/);
  assert.match(admin, /bucket: "Z klapą"/);
  assert.match(admin, /mini: "Strukturalna \/ mini"/);
  assert.match(admin, /"Ścieg szydełkowy"/);
  assert.match(admin, /classic: "Ażurowy V"/);
  assert.match(admin, /herringbone: "Pionowy ażurowy"/);
  assert.match(admin, /shell: "Promienisty"/);
  assert.doesNotMatch(admin, /Prostokątna|Półokrągła|Kubełkowa|Jodełka|Muszla/);
  assert.match(admin, /\/api\/admin\/bag-builder-settings/);
  assert.match(panel, /BagBuilderSettingsManager/);
});

test("commerce layer is mounted into the live customizer and styled after 3D", () => {
  assert.match(exact, /BagBuilderCommerce/);
  assert.match(layout, /bag-builder-commerce\.css/);
  assert.match(layout, /bag-builder-admin\.css/);
});
