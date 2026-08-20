import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const patchScript = path.join(repoRoot, "scripts", "remove-free-shipping.mjs");

test("storefront build patch removes the 300 PLN free-shipping rule", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "abags-shipping-"));
  const appDir = path.join(tempRoot, "app");
  fs.mkdirSync(appDir, { recursive: true });

  const fixture = `
const delivery = cartCount === 0 || subtotal >= 300 ? 0 : 14.99;
{siteContent.announcement.visible && (
  <div>announcement</div>
)}
<div className="cart-summary">
  {subtotal < 300 && (
    <p className="shipping-progress">
      Jeszcze {priceFormatter.format(300 - subtotal)} do darmowej dostawy
    </p>
  )}
  <div><span>Dostawa</span><span>{delivery === 0 ? "bezpłatnie" : priceFormatter.format(delivery)}</span></div>
</div>
`;

  const pagePath = path.join(appDir, "page.tsx");
  fs.writeFileSync(pagePath, fixture);

  execFileSync(process.execPath, [patchScript], {
    env: { ...process.env, SITES_PROJECT_ROOT: tempRoot },
    stdio: "pipe",
  });

  const patched = fs.readFileSync(pagePath, "utf8");
  assert.match(patched, /const delivery = cartCount === 0 \? 0 : 14\.99;/);
  assert.doesNotMatch(patched, /subtotal >= 300/);
  assert.doesNotMatch(patched, /do darmowej dostawy/);
  assert.doesNotMatch(patched, /delivery === 0 \? "bezpłatnie"/);
  assert.match(patched, /siteContent\.announcement\.visible/);

  fs.rmSync(tempRoot, { recursive: true, force: true });
});
