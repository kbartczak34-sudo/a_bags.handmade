import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("required Polish legal pages are present", () => {
  const requiredPages = [
    "app/regulamin/page.tsx",
    "app/polityka-prywatnosci/page.tsx",
    "app/cookies/page.tsx",
    "app/zwroty-i-reklamacje/page.tsx",
    "app/bezpieczenstwo-produktow/page.tsx",
  ];

  for (const page of requiredPages) {
    assert.equal(fs.existsSync(path.join(repoRoot, page)), true, `${page} must exist`);
  }
});

test("production checkout fails closed when legal configuration is incomplete", () => {
  const worker = read("worker/index.ts");
  const legalConfig = read("lib/legal-config.ts");
  assert.match(worker, /url\.pathname === "\/api\/checkout"/);
  assert.match(worker, /getPublicLegalConfig\(\)/);
  assert.match(worker, /readinessIssues\.length > 0/);
  assert.match(worker, /legal_configuration_incomplete/);
  assert.match(legalConfig, /transactionalEmailReady/);
  assert.match(legalConfig, /LEGAL_PRODUCT_COMPLIANCE_CONFIRMED/);
  assert.match(legalConfig, /LEGAL_PACKAGING_COMPLIANCE_CONFIRMED/);
  assert.match(legalConfig, /LEGAL_FISCAL_COMPLIANCE_CONFIRMED/);
  assert.match(legalConfig, /LEGAL_PRIVACY_COMPLIANCE_CONFIRMED/);
});

test("VAT display is driven by legal status instead of always claiming 23 percent", () => {
  const vatEnhancer = read("app/vat-display-enhancer.tsx");
  const products = read("lib/products.ts");
  assert.match(vatEnhancer, /vatMode === "active_23"/);
  assert.match(vatEnhancer, /vatMode === "exempt"/);
  assert.match(products, /LEGAL_VAT_MODE/);
  assert.match(products, /vatActive \? VAT_RATE_PERCENT : 0/);
});

test("paid Stripe orders trigger a durable confirmation email", () => {
  const webhook = read("app/api/stripe/webhook/route.ts");
  const email = read("lib/order-email.ts");
  assert.match(webhook, /sendOrderConfirmationEmail\(session\)/);
  assert.match(webhook, /isSuccessfulPaymentEvent && isPaid/);
  assert.match(email, /Idempotency-Key/);
  assert.match(email, /Zachowaj tę wiadomość jako potwierdzenie/);
});

test("public review UI discloses that purchases are not verified", () => {
  const enhancer = read("app/legal-compliance-enhancer.tsx");
  assert.match(enhancer, /zakup nieweryfikowany/);
  assert.match(enhancer, /nie są obecnie weryfikowane na podstawie numeru zamówienia/);
});

test("optional Instagram scripts are blocked by CSP until server-visible consent exists", () => {
  const worker = read("worker/index.ts");
  const enhancer = read("app/legal-compliance-enhancer.tsx");
  assert.match(worker, /hasExternalContentConsent/);
  assert.match(worker, /Content-Security-Policy/);
  assert.match(worker, /abags-external-content=accepted/);
  assert.match(enhancer, /document\.cookie = `abags-external-content=/);
  assert.match(enhancer, /clearExternalContentPreference/);
});

test("server privacy form is never covered by a duplicate client banner on older Android browsers", () => {
  const css = read("app/legal-compliance.css");
  const banner = read("app/privacy-consent-banner.tsx");
  assert.match(css, /\.privacy-banner-server\s*~\s*\.privacy-banner:not\(\.privacy-banner-server\)\s*\{[\s\S]*?display:\s*none\s*!important/);
  assert.doesNotMatch(css, /body:has\(/);
  assert.match(banner, /method="post"/);
  assert.match(banner, /action="\/api\/privacy-choice"/);
});

test("VAT MutationObserver writes only when displayed text actually changes", () => {
  const vatEnhancer = read("app/vat-display-enhancer.tsx");
  assert.match(vatEnhancer, /function setTextIfChanged/);
  assert.match(vatEnhancer, /if \(node\.textContent !== value\) node\.textContent = value/);
  assert.match(vatEnhancer, /setTextIfChanged\(note, status\.vatLabel\)/);
  assert.doesNotMatch(vatEnhancer, /note\.textContent = status\.vatLabel/);
});
