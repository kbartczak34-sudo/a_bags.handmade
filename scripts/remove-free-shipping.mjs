import fs from "node:fs";
import path from "node:path";

const root = process.env.SITES_PROJECT_ROOT || process.cwd();
const file = path.join(root, "app", "page.tsx");
let source = fs.readFileSync(file, "utf8");

const replacements = [
  [
    'const delivery = cartCount === 0 || subtotal >= 300 ? 0 : 14.99;',
    'const delivery = cartCount === 0 ? 0 : 14.99;',
  ],
  [
    '{siteContent.announcement.visible && (',
    '{false && (',
  ],
  [
    `                  {subtotal < 300 && (\n                    <p className="shipping-progress">\n                      Jeszcze {priceFormatter.format(300 - subtotal)} do darmowej dostawy\n                    </p>\n                  )}\n`,
    '',
  ],
];

for (const [from, to] of replacements) {
  if (!source.includes(from)) {
    throw new Error(`Expected storefront fragment not found: ${from.slice(0, 80)}`);
  }
  source = source.replace(from, to);
}

fs.writeFileSync(file, source);
console.log("Removed free-shipping threshold and promotion from storefront build.");
