import type { Product } from "@/types/product";

/** عدد را با جداکننده هزارگان فارسی قالب‌بندی می‌کند. */
export function formatPrice(value: number): string {
  return new Intl.NumberFormat("fa-IR").format(Math.round(value));
}

/** آیا محصول قیمت تخفیف‌خورده دارد؟ */
export function isDiscounted(
  product: Pick<Product, "price" | "oldPrice">
): boolean {
  return (
    typeof product.price === "number" &&
    typeof product.oldPrice === "number" &&
    product.oldPrice > product.price
  );
}

/** درصد تخفیف را به‌صورت عدد صحیح برمی‌گرداند. */
export function discountPercent(
  price: number,
  oldPrice: number
): number {
  if (!oldPrice || oldPrice <= price) return 0;
  return Math.round(((oldPrice - price) / oldPrice) * 100);
}
