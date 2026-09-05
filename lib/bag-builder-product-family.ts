import type { CatalogProduct } from "./catalog";

export type BagBuilderProductFamily = "tote" | "round" | "bucket" | "mini";

type ProductFamilySource = Pick<CatalogProduct, "name" | "detail" | "stitchType">;

export function inferBagBuilderProductFamily(product: ProductFamilySource): BagBuilderProductFamily {
  const text = `${product.name} ${product.detail} ${product.stitchType}`.toLowerCase();

  if (/\bmini\b|ma[łl]a|small|kopert|crossbody|struktural/.test(text)) return "mini";
  if (/kube[łl]|bucket|worek|workowa/.test(text)) return "bucket";
  if (/okr[aą]g|p[oó][łl]okr[aą]g|round|half.?moon|p[oó][łl]ksi[eę][żz]yc/.test(text)) return "round";

  // Photo-True historically treats an otherwise unclassified photographed model as the classic tote family.
  return "tote";
}