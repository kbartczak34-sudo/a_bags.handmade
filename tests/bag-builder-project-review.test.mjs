import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const review = fs.readFileSync("app/bag-builder-project-review.tsx", "utf8");
const exact = fs.readFileSync("app/exact-live-customizer.tsx", "utf8");

test("project review is mounted with the active Bag Builder", () => {
  assert.match(exact, /BagBuilderProjectReview/);
  assert.match(exact, /<BagBuilderProjectReview \/>/);
});

test("review covers every Bag Builder decision and the real material", () => {
  assert.match(review, /Sznurek poliestrowy · Pimiotki/);
  assert.match(review, /Fason:/);
  assert.match(review, /Kolor sznurka:/);
  assert.match(review, /Ścieg szydełkowy:/);
  assert.match(review, /Klapa:/);
  assert.match(review, /Uchwyty:/);
  assert.match(review, /Pasek:/);
  assert.match(review, /Okucia:/);
  assert.match(review, /Detal \/ ozdoba:/);
});

test("review uses the same Agata family and crochet-stitch language as the live builder", () => {
  assert.match(review, /tote: "Kuferek \/ tote"/);
  assert.match(review, /round: "Okrągła"/);
  assert.match(review, /bucket: "Z klapą"/);
  assert.match(review, /mini: "Strukturalna \/ mini"/);
  assert.match(review, /classic: "Ażurowy V"/);
  assert.match(review, /herringbone: "Pionowy ażurowy"/);
  assert.match(review, /basket: "Koszykowy"/);
  assert.match(review, /shell: "Promienisty"/);
  assert.doesNotMatch(review, /Prostokątna|Półokrągła|Kubełkowa|Jodełka|Muszla/);
});

test("Photo-True project identity uses the actual photographed A-Bags product", () => {
  assert.match(review, /function readPhotoIdentity/);
  assert.match(review, /stage\.dataset\.photoProductId/);
  assert.match(review, /stage\.dataset\.photoProductName/);
  assert.match(review, /stage\.dataset\.abagsPhotoTrue === "active"/);
  assert.match(review, /Model bazowy 1:1:/);
  assert.match(review, /ID produktu bazowego:/);
});

test("project code changes when the real Photo-True base product changes", () => {
  assert.match(review, /function projectCode/);
  assert.match(review, /Object\.values\(config\)\.join\("\|"\)/);
  assert.match(review, /photo\.active \? `\$\{photo\.productId\}\|\$\{legacySignature\}` : legacySignature/);
  assert.match(review, /AB-/);
  assert.match(review, /Math\.imul\(hash, 16777619\)/);
});

test("complete specification can be copied without enabling incomplete Photo-True projects", () => {
  assert.match(review, /Kopiuj specyfikację/);
  assert.match(review, /navigator\.clipboard/);
  assert.match(review, /document\.execCommand\("copy"\)/);
  assert.match(review, /button\.disabled = !isComplete\(config, photo\)/);
  assert.match(review, /!photo\.active \|\| photo\.productId/);
});

test("the same project code and real model are included in workshop handoff", () => {
  assert.match(review, /function synchronizeWorkshopLink/);
  assert.match(review, /Kod projektu:/);
  assert.match(review, /Model bazowy 1:1:/);
  assert.match(review, /photo\.productId/);
  assert.match(review, /url\.searchParams\.set\("text", nextText\)/);
});

test("Photo-True identity mutations refresh the visible specification", () => {
  assert.match(review, /data-abags-photo-true/);
  assert.match(review, /data-photo-product-id/);
  assert.match(review, /data-photo-product-name/);
});

test("review keeps pricing individually confirmed by the workshop", () => {
  assert.match(review, /Cena personalizacji: do indywidualnego potwierdzenia przez pracownię/);
  assert.doesNotMatch(review, /optionPrice|previewPrice|surcharge|dopłat|doplat/i);
});
