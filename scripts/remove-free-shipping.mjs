import fs from "node:fs";
import path from "node:path";

const root = process.env.SITES_PROJECT_ROOT || process.cwd();
const file = path.join(root, "app", "page.tsx");
let source = fs.readFileSync(file, "utf8");

const exactReplacements = [
  [
    "const delivery = cartCount === 0 || subtotal >= 300 ? 0 : 14.99;",
    "const delivery = cartCount === 0 ? 0 : 14.99;",
  ],
  [
    `                  {subtotal < 300 && (\n                    <p className="shipping-progress">\n                      Jeszcze {priceFormatter.format(300 - subtotal)} do darmowej dostawy\n                    </p>\n                  )}\n`,
    "",
  ],
  [
    '<div><span>Dostawa</span><span>{delivery === 0 ? "bezpłatnie" : priceFormatter.format(delivery)}</span></div>',
    '<div><span>Dostawa</span><span>{priceFormatter.format(delivery)}</span></div>',
  ],
];

for (const [from, to] of exactReplacements) {
  if (!source.includes(from)) {
    throw new Error(`Expected storefront fragment not found: ${from.slice(0, 120)}`);
  }
  source = source.replace(from, to);
}

// The delivery row appears once in the cart and once in checkout summary.
// The replacement above handles the first occurrence; normalize any remaining one.
source = source.replace(
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

fs.writeFileSync(file, source);
console.log("Storefront shipping normalized: fixed 14.99 PLN delivery, no free-shipping threshold.");
