import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const store = fs.readFileSync("lib/customer-cases.ts", "utf8");
const publicApi = fs.readFileSync("app/api/customer-cases/route.ts", "utf8");
const adminApi = fs.readFileSync("app/api/admin/customer-cases/route.ts", "utf8");
const form = fs.readFileSync("app/zwroty-i-reklamacje/zgloszenie/case-form.tsx", "utf8");
const page = fs.readFileSync("app/zwroty-i-reklamacje/zgloszenie/page.tsx", "utf8");
const legalPage = fs.readFileSync("app/zwroty-i-reklamacje/page.tsx", "utf8");
const adminPanel = fs.readFileSync("app/panel/admin-panel.tsx", "utf8");
const adminManager = fs.readFileSync("app/panel/customer-cases-manager.tsx", "utf8");

test("customer cases are stored in D1 with complaint response deadlines", () => {
  assert.match(store, /CREATE TABLE IF NOT EXISTS customer_cases/);
  assert.match(store, /response_due_at TEXT/);
  assert.match(store, /COMPLAINT_RESPONSE_DAYS = 14/);
  assert.match(store, /COMPLAINT_RESPONSE_DAYS \* 24 \* 60 \* 60 \* 1000/);
  assert.match(store, /type === "complaint"/);
});

test("public case submission is rate limited without storing raw IP addresses", () => {
  assert.match(publicApi, /crypto\.subtle\.digest/);
  assert.match(publicApi, /a-bags-customer-case:/);
  assert.match(publicApi, /consumeCustomerCaseSubmission/);
  assert.match(publicApi, /429/);
  assert.doesNotMatch(store, /ip_address|raw_ip/i);
});

test("customer case form minimizes data and does not require a RODO consent checkbox", () => {
  assert.match(form, /\/polityka-prywatnosci/);
  assert.match(form, /Nie wymagamy osobnej/);
  assert.doesNotMatch(form, /type="file"/);
  assert.doesNotMatch(form, /Zgadzam się na przetwarzanie/i);
  assert.match(page, /Formularz zgłoszenia/);
});

test("returns page links to the online workflow without making it mandatory", () => {
  assert.match(legalPage, /\/zwroty-i-reklamacje\/zgloszenie/);
  assert.match(legalPage, /nie jest obowiązkowe/i);
});

test("owner customer-case API is protected and panel exposes deadline-aware case management", () => {
  assert.match(adminApi, /isAdminRequest/);
  assert.match(adminApi, /Brak dostępu do spraw klientów/);
  assert.match(adminPanel, /CustomerCasesManager/);
  assert.match(adminPanel, /Zwroty \/ reklamacje/);
  assert.match(adminManager, /14-dniowy termin odpowiedzi/);
  assert.match(adminManager, /Po terminie/);
  assert.match(adminManager, /mailto:/);
});
