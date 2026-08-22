import fs from "node:fs";
import path from "node:path";

const root = process.env.SITES_PROJECT_ROOT || process.cwd();
const file = path.join(root, "app", "page.tsx");
let source = fs.readFileSync(file, "utf8");

source = source.replace(
  "const delivery = cartCount === 0 || subtotal >= 300 ? 0 : 14.99;",
  "const delivery = cartCount === 0 ? 0 : 14.99;",
);

// Remove the free-shipping progress block without depending on indentation.
source = source.replace(
  /\s*\{subtotal < 300 && \(\s*<p className="shipping-progress">[\s\S]*?<\/p>\s*\)\}\s*/g,
  "\n",
);

// Normalize every visible delivery row. The row appears in cart and checkout.
source = source.replaceAll(
  '<div><span>Dostawa</span><span>{delivery === 0 ? "bezpłatnie" : priceFormatter.format(delivery)}</span></div>',
  '<div><span>Dostawa</span><span>{priceFormatter.format(delivery)}</span></div>',
);

const forbiddenFragments = [
  "subtotal >= 300",
  "do darmowej dostawy",
  'delivery === 0 ? "bezpłatnie"',
];

for (const fragment of forbiddenFragments) {
  if (source.includes(fragment)) {
    throw new Error(`Free-shipping fragment still present after patch: ${fragment}`);
  }
}

if (!source.includes("const delivery = cartCount === 0 ? 0 : 14.99;")) {
  throw new Error("Fixed 14.99 PLN delivery rule was not found after patching.");
}

fs.writeFileSync(file, source);
console.log("Storefront shipping normalized: fixed 14.99 PLN delivery, no free-shipping threshold.");
