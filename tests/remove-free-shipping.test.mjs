import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(repoRoot, "app", "page.tsx"), "utf8");

test("storefront source keeps fixed 14.99 PLN delivery without a free-shipping threshold", () => {
  assert.match(source, /const delivery = cartCount === 0 \? 0 : 14\.99;/);
  assert.doesNotMatch(source, /subtotal >= 300/);
  assert.doesNotMatch(source, /do darmowej dostawy/);
  assert.doesNotMatch(source, /delivery === 0 \? "bezpłatnie"/);
  assert.match(
    source,
    /<div><span>Dostawa<\/span><span>\{priceFormatter\.format\(delivery\)\}<\/span><\/div>/,
  );
});
