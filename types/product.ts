export type ProductCategory =
  | "شوینده"
  | "نوشیدنی"
  | "بهداشتی"
  | "مواد غذایی";

export type Product = {
  id: string;
  name: string;
  category: ProductCategory;
  description: string;
  image: string;
  price?: number;
  oldPrice?: number;
  variantId?: string;
  modelId?: string;
  stock?: number;
};
