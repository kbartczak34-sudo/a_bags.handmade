export type CatalogProduct = {
  id: string;
  number: string;
  name: string;
  detail: string;
  tone: string;
  price: number;
  unitAmount: number;
  imageUrl: string | null;
  isVisible: boolean;
  sortOrder: number;
};

export const products: CatalogProduct[] = [
  {
    id: "lila",
    number: "01",
    name: "Torebka Lila",
    detail: "Fiolet · ręcznie pleciona",
    tone: "product-lilac",
    price: 189,
    unitAmount: 18_900,
    imageUrl: null,
    isVisible: true,
    sortOrder: 10,
  },
  {
    id: "rose",
    number: "02",
    name: "Torebka Rose",
    detail: "Pudrowy róż · z frędzlami",
    tone: "product-rose",
    price: 219,
    unitAmount: 21_900,
    imageUrl: null,
    isVisible: true,
    sortOrder: 20,
  },
  {
    id: "natural",
    number: "03",
    name: "Torebka Natural",
    detail: "Piaskowy beż · klasyczna",
    tone: "product-sand",
    price: 199,
    unitAmount: 19_900,
    imageUrl: null,
    isVisible: true,
    sortOrder: 30,
  },
];

export const catalogById = new Map(
  products.map((product) => [product.id, product]),
);

export const freeShippingThreshold = 30_000;
export const standardShippingAmount = 1_499;
