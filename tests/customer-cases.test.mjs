import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const store = fs.readFileSync("lib/customer-cases.ts", "utf8");
const email = fs.readFileSync("lib/customer-case-email.ts", "utf8");
const publicApi = fs.readFileSync("app/api/customer-cases/route.ts", "utf8");
const adminApi = fs.readFileSync("app/api/admin/customer-cases/route.ts", "utf8");
const form = fs.readFileSync("app/zwroty-i-reklamacje/zgloszenie/case-form.tsx", "utf8");
const page = fs.readFileSync("app/zwroty-i-reklamacje/zgloszenie/page.tsx", "utf8");
const legalPage = fs.readFileSync("app/zwroty-i-reklamacje/page.tsx", "utf8");
const privacyPage = fs.readFileSync("app/polityka-prywatnosci/page.tsx", "utf8");
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

test("customer case submission sends a durable idempotent email confirmation and records delivery", () => {
  assert.match(email, /https:\/\/api\.resend\.com\/emails/);
  assert.match(email, /Idempotency-Key/);
  assert.match(email, /customer-case-confirmation\/\$\{input\.id\}/);
  assert.match(email, /Zachowaj tę wiadomość jako potwierdzenie wysłania zgłoszenia/);
  assert.match(publicApi, /sendCustomerCaseConfirmationEmail/);
  assert.match(publicApi, /markCustomerCaseConfirmationSent/);
  assert.match(publicApi, /confirmationEmailSent/);
  assert.match(store, /confirmation_email_sent_at TEXT/);
  assert.match(adminManager, /Potwierdzenie e-mail/);
  assert.match(adminManager, /brak potwierdzonej wysyłki/);
});

test("customer case form minimizes data and does not require a RODO consent checkbox", () => {
  assert.match(form, /\/polityka-prywatnosci/);
  assert.match(form, /Nie wymagamy osobnej/);
  assert.doesNotMatch(form, /type="file"/);
  assert.doesNotMatch(form, /Zgadzam się na przetwarzanie/i);
  assert.match(page, /Formularz zgłoszenia/);
});

test("privacy policy documents the persistent customer-case workflow", () => {
  assert.match(privacyPage, /dane podane w zgłoszeniu odstąpienia od umowy lub reklamacji/i);
  assert.match(privacyPage, /numer sprawy nadawany przez system/i);
  assert.match(privacyPage, /Odstąpienia od umowy i reklamacje/);
  assert.match(privacyPage, /Cloudflare.*baza danych/i);
  assert.match(privacyPage, /historia spraw dotyczących odstąpień oraz reklamacji/i);
  assert.match(privacyPage, /24 sierpnia 2026 r\./);
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
