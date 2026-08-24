import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(repoRoot, "app", "page.tsx"), "utf8");

test("checkout exposes accessible pending and error states", () => {
  assert.match(source, /const checkoutErrorRef = useRef<HTMLParagraphElement>\(null\);/);
  assert.match(source, /checkoutErrorRef\.current\?\.focus\(\);/);
  assert.match(source, /<form onSubmit=\{handleCheckout\} aria-busy=\{checkoutPending\}>/);
  assert.match(source, /inputMode="email"/);
  assert.match(source, /aria-describedby="checkout-email-hint"/);
  assert.match(source, /id="checkout-email-hint"/);
  assert.match(source, /role="alert"/);
  assert.match(source, /aria-live="assertive"/);
  assert.match(source, /aria-atomic="true"/);
  assert.match(source, /tabIndex=\{-1\}/);
});
