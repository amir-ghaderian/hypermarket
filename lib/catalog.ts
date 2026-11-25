import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Product } from "@/types/product";

type ProductRow = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  image: string | null;
  old_price: number | null;
};
type VariantRow = { id: string; product_id: string; sale_price_toman: number | null };
type BalanceRow = { variant_id: string; quantity: number | null };

/**
 * کاتالوگ فروشگاه مستقیماً از Supabase خوانده می‌شود (همان منبع پنل مدیریت):
 * نام/دسته/توضیح/تصویر از products، قیمت از product_variants و موجودی از inventory_balances.
 */
export async function getStoreProducts(): Promise<Product[]> {
  const supabase = supabaseAdmin();

  const [productsResult, variantsResult, balancesResult] = await Promise.all([
    supabase.from("products").select("id, name, category, description, image, old_price"),
    supabase.from("product_variants").select("id, product_id, sale_price_toman"),
    supabase.from("inventory_balances").select("variant_id, quantity"),
  ]);
  if (productsResult.error) throw productsResult.error;
  if (variantsResult.error) throw variantsResult.error;
  if (balancesResult.error) throw balancesResult.error;

  const productById = new Map((productsResult.data ?? []).map((p) => [p.id, p as ProductRow]));
  const balanceByVariant = new Map((balancesResult.data ?? []).map((b) => [b.variant_id, Number(b.quantity ?? 0)]));

  return (variantsResult.data ?? [])
    .map((variant) => {
      const product = productById.get((variant as VariantRow).product_id);
      const image = product?.image && product.image.trim() !== "" ? product.image : "/file.svg";
      return {
        id: variant.id,
        variantId: variant.id,
        modelId: (variant as VariantRow).product_id,
        name: product?.name ?? "",
        category: (product?.category ?? "بهداشتی") as Product["category"],
        description: product?.description ?? "",
        image,
        price: variant.sale_price_toman ?? undefined,
        oldPrice: product?.old_price ?? undefined,
        stock: balanceByVariant.get(variant.id) ?? 0,
      } satisfies Product;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
