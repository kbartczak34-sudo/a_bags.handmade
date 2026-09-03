import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const email = fs.readFileSync("lib/order-email.ts", "utf8");

test("order email treats only validated AB codes as personalized projects", () => {
  assert.match(email, /function readBuilderProjectCode/);
  assert.match(email, /builder_project_code/);
  assert.match(email, /\^AB-\[A-Z0-9\]\{7\}\$/);
  assert.match(email, /return .* \? value : null/);
});

test("personalized confirmation carries project code material and stored specification", () => {
  assert.match(email, /Twój projekt A-Bags/);
  assert.match(email, /Kod projektu A-Bags:/);
  assert.match(email, /sznurek poliestrowy z Pimiotki/);
  assert.match(email, /Specyfikacja projektu:/);
  assert.match(email, /session\.metadata\?\.cart/);
  assert.match(email, /slice\(0, 500\)/);
});

test("personalized subject makes the durable project reference easy to find", () => {
  assert.match(email, /Potwierdzenie projektu \$\{builderProjectCode\} · zamówienie #\$\{orderNumber\}/);
  assert.match(email, /Zachowaj tę wiadomość oraz kod projektu/);
});

test("regular orders retain the existing generic confirmation path", () => {
  assert.match(email, /Potwierdzenie zamówienia #\$\{orderNumber\} · a_bags\.handmade/);
  assert.match(email, /Pozycje zamówienia:/);
  assert.match(email, /personalizedProject \? "" :/);
});

test("email still escapes project-controlled text before rendering HTML", () => {
  assert.match(email, /escapeHtml\(builderProjectCode\)/);
  assert.match(email, /escapeHtml\(cartReference\)/);
  assert.match(email, /Idempotency-Key/);
  assert.match(email, /order-confirmation\/\$\{session\.id\}/);
});
