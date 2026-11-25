import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

// منبع دادهٔ این API فقط Supabase است (SQLite دخالتی ندارد).
export const dynamic = "force-dynamic";

type ProductRow = {
  id: string;
  product_code: string;
  name: string;
  category: string | null;
  subcategory: string | null;
  description: string | null;
  image: string | null;
  old_price: number | null;
};

type VariantRow = {
  id: string;
  product_id: string;
  variant_code: string;
  variant_label: string | null;
  sale_unit: string | null;
  purchase_price_toman: number | null;
  sale_price_toman: number | null;
};

type BalanceRow = {
  variant_id: string;
  quantity: number | null;
  quantity_confirmed: boolean | null;
};

/**
 * صفحه «موجودی انبار» (فقط‌خواندنی) — دادهٔ واقعی Supabase.
 *
 * ارتباط جداول دقیقاً با کلیدهای واقعی (بدون تطبیق حدسی بر اساس نام/کد):
 *   inventory_balances.variant_id = product_variants.id
 *   product_variants.product_id   = products.id
 */
export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ message: "ابتدا وارد شوید." }, { status: 401 });
  }

  try {
    const supabase = supabaseAdmin();

    const [productsResult, variantsResult, balancesResult] = await Promise.all([
      supabase.from("products").select("id, product_code, name, category, subcategory, description, image, old_price"),
      supabase
        .from("product_variants")
        .select(
          "id, product_id, variant_code, variant_label, sale_unit, purchase_price_toman, sale_price_toman",
        ),
      supabase
        .from("inventory_balances")
        .select("variant_id, quantity, quantity_confirmed"),
    ]);

    if (productsResult.error) throw productsResult.error;
    if (variantsResult.error) throw variantsResult.error;
    if (balancesResult.error) throw balancesResult.error;

    const products = (productsResult.data ?? []) as ProductRow[];
    const variants = (variantsResult.data ?? []) as VariantRow[];
    const balances = (balancesResult.data ?? []) as BalanceRow[];

    const productById = new Map(products.map((row) => [row.id, row]));
    const balanceByVariant = new Map(balances.map((row) => [row.variant_id, row]));
    const isAdmin = user.role === "admin";

    const items = variants
      .map((variant) => {
        const product = productById.get(variant.product_id) ?? null;
        const balance = balanceByVariant.get(variant.id) ?? null;

        return {
          product_id: variant.product_id,
          product_code: product?.product_code ?? null,
          product_name: product?.name ?? null,
          category: product?.category ?? null,
          subcategory: product?.subcategory ?? null,
          description: product?.description ?? null,
          image: product?.image ?? null,
          old_price: product?.old_price ?? null,
          variant_id: variant.id,
          variant_code: variant.variant_code,
          variant_label: variant.variant_label,
          sale_unit: variant.sale_unit,
          // قیمت خرید فقط برای مدیر برگردانده می‌شود؛ فروشنده مقدار null می‌گیرد.
          purchase_price: isAdmin ? (variant.purchase_price_toman ?? null) : null,
          sale_price: variant.sale_price_toman ?? null,
          quantity: balance ? (balance.quantity ?? 0) : null,
          confirmed: balance ? (balance.quantity_confirmed ?? null) : null,
          has_balance: balance !== null,
        };
      })
      .sort((a, b) => {
        const byCode = (a.product_code ?? "").localeCompare(b.product_code ?? "");
        if (byCode !== 0) return byCode;
        return a.variant_code.localeCompare(b.variant_code);
      });

    const counts = {
      products: products.length,
      variants: variants.length,
      balances: balances.length,
      variants_without_balance: items.filter((item) => !item.has_balance).length,
      zero_stock: items.filter((item) => item.has_balance && (item.quantity ?? 0) < 1).length,
    };

    return NextResponse.json({
      success: true,
      canSeePurchase: isAdmin,
      counts,
      items,
    });
  } catch (error) {
    console.error("Inventory fetch from Supabase failed:", error);
    return NextResponse.json(
      { success: false, message: "دریافت موجودی از Supabase ناموفق بود." },
      { status: 500 },
    );
  }
}
