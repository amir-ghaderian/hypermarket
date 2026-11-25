import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * فروش اینترنتی فروشگاه — دادهٔ واقعی Supabase.
 * از همان RPC اتمیک `record_sale` استفاده می‌کند (channel = online)، پس موجودی
 * `inventory_balances` همان واریانت کاهش و در `stock_movements` ثبت می‌شود.
 * قیمت‌ها و موجودی از سمت سرور اعتبارسنجی می‌شوند؛ اطلاعات مرورگر مرجع نیست.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const items = body.items as { variantId: string; quantity: number }[];
    if (!Array.isArray(items) || items.length < 1 || items.length > 100) {
      return NextResponse.json({ message: "اقلام سفارش معتبر نیست." }, { status: 400 });
    }

    const normalized = new Map<string, number>();
    for (const item of items) {
      const variantId = typeof item.variantId === "string" ? item.variantId.trim() : "";
      const quantity = Number(item.quantity);
      if (!UUID_RE.test(variantId) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100000) {
        return NextResponse.json({ message: "تعداد یا کالای انتخاب‌شده معتبر نیست." }, { status: 400 });
      }
      normalized.set(variantId, (normalized.get(variantId) ?? 0) + quantity);
    }

    const supabase = supabaseAdmin();
    const variantIds = [...normalized.keys()];

    const { data: variants, error: variantsError } = await supabase
      .from("product_variants")
      .select("id, product_id, variant_code, sale_price_toman, purchase_price_toman")
      .in("id", variantIds);
    if (variantsError) throw variantsError;

    const { data: balances, error: balancesError } = await supabase
      .from("inventory_balances")
      .select("variant_id, quantity")
      .in("variant_id", variantIds);
    if (balancesError) throw balancesError;

    const productIds = [...new Set((variants ?? []).map((v) => v.product_id))];
    const { data: products, error: productsError } = await supabase.from("products").select("id, name").in("id", productIds);
    if (productsError) throw productsError;

    const variantById = new Map((variants ?? []).map((v) => [v.id, v]));
    const productById = new Map((products ?? []).map((p) => [p.id, p]));
    const balanceByVariant = new Map((balances ?? []).map((b) => [b.variant_id, Number(b.quantity ?? 0)]));

    const rows: { variant_id: string; quantity: number; unit_price: number; unit_cost: number }[] = [];
    for (const [id, quantity] of normalized) {
      const variant = variantById.get(id);
      if (!variant) return NextResponse.json({ message: "کالای انتخاب‌شده پیدا نشد." }, { status: 400 });
      const stock = balanceByVariant.get(id) ?? 0;
      const label = productById.get(variant.product_id)?.name ?? variant.variant_code;
      if (stock < quantity) {
        return NextResponse.json({ message: `موجودی «${label}» کافی نیست (موجودی: ${stock}).` }, { status: 409 });
      }
      rows.push({ variant_id: id, quantity, unit_price: variant.sale_price_toman ?? 0, unit_cost: variant.purchase_price_toman ?? 0 });
    }

    const total = rows.reduce((sum, row) => sum + row.unit_price * row.quantity, 0);

    const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
    const invoiceNumber = UUID_RE.test(requestId)
      ? `WEB-${requestId}`
      : `WEB-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    const { error: rpcError } = await supabase.rpc("record_sale", {
      p_invoice_number: invoiceNumber,
      p_channel: "online",
      p_discount: 0,
      p_notes: "سفارش اینترنتی فروشگاه",
      p_created_by: null,
      p_customer_id: null,
      p_paid_amount: total,
      p_items: rows,
    });
    if (rpcError) {
      if (rpcError.code === "23505") {
        return NextResponse.json({ success: true, order: { invoiceNumber, total } }, { status: 200 });
      }
      if ((rpcError.message ?? "").includes("INSUFFICIENT_STOCK")) {
        return NextResponse.json({ message: "موجودی یکی از اقلام کافی نیست." }, { status: 409 });
      }
      throw rpcError;
    }

    return NextResponse.json({ success: true, order: { invoiceNumber, total } }, { status: 201 });
  } catch (error) {
    console.error("Online checkout failed:", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "ثبت سفارش انجام نشد." },
      { status: 500 },
    );
  }
}
