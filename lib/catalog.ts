export const VAT_RATE_PERCENT = 23;

export function grossFromNetCents(netCents: number) {
  return Math.round((netCents * (100 + VAT_RATE_PERCENT)) / 100);
}

export function vatFromNetCents(netCents: number) {
  return grossFromNetCents(netCents) - netCents;
}

export type CatalogProduct = {
  id: string;
  number: string;
  name: string;
  detail: string;
  tone: string;
  price: number;
  unitAmount: number;
  netAmount: number;
  vatAmount: number;
  vatRate: number;
  imageUrl: string | null;
  isVisible: boolean;
  sortOrder: number;
};

function fallbackProduct(input: Omit<CatalogProduct, "price" | "unitAmount" | "vatAmount" | "vatRate">): CatalogProduct {
  const unitAmount = grossFromNetCents(input.netAmount);
  return {
    ...input,
    price: unitAmount / 100,
    unitAmount,
    vatAmount: unitAmount - input.netAmount,
    vatRate: VAT_RATE_PERCENT,
  };
}

export const products: CatalogProduct[] = [
  fallbackProduct({
    id: "lila",
    number: "01",
    name: "Torebka Lila",
    detail: "Fiolet · ręcznie pleciona",
    tone: "product-lilac",
    netAmount: 18_900,
    imageUrl: null,
    isVisible: true,
    sortOrder: 10,
  }),
  fallbackProduct({
    id: "rose",
    number: "02",
    name: "Torebka Rose",
    detail: "Pudrowy róż · z frędzlami",
    tone: "product-rose",
    netAmount: 21_900,
    imageUrl: null,
    isVisible: true,
    sortOrder: 20,
  }),
  fallbackProduct({
    id: "natural",
    number: "03",
    name: "Torebka Natural",
    detail: "Piaskowy beż · klasyczna",
    tone: "product-sand",
    netAmount: 19_900,
    imageUrl: null,
    isVisible: true,
    sortOrder: 30,
  }),
];

export const catalogById = new Map(
  products.map((product) => [product.id, product]),
);

// Dostawa jest zawsze płatna. Nie utrzymujemy progu darmowej dostawy,
// aby UI i Stripe Checkout zawsze korzystały z tej samej reguły cenowej.
export const standardShippingAmount = 1_499;
