import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

type SaleLine = { variantId: string; quantity: number };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * دریافت فهرست فاکتورها — دادهٔ واقعی Supabase (sales + sale_items + users + customers).
 * تاریخ‌ها بر اساس ستون sold_at (timestamptz) فیلتر می‌شوند.
 */
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ message: "ابتدا وارد شوید." }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ message: "فقط مدیر اجازهٔ مشاهدهٔ فاکتورهای قبلی را دارد." }, { status: 403 });

  try {
    const url = new URL(request.url);
    const from = url.searchParams.get("from") || "1970-01-01";
    const to = url.searchParams.get("to") || "2999-12-31";
    const supabase = supabaseAdmin();

    const { data: sales, error } = await supabase
      .from("sales")
      .select("id, invoice_number, total_amount, discount, notes, sold_at, created_by, customer_id")
      .gte("sold_at", `${from}T00:00:00.000Z`)
      .lte("sold_at", `${to}T23:59:59.999Z`)
      .order("id", { ascending: false })
      .limit(200);
    if (error) throw error;

    const rows = sales ?? [];
    const userIds = [...new Set(rows.map((r) => Number(r.created_by)).filter((n) => Number.isFinite(n) && n > 0))];
    const customerIds = [...new Set(rows.map((r) => Number(r.customer_id)).filter((n) => Number.isFinite(n) && n > 0))];
    const saleIds = rows.map((r) => Number(r.id)).filter((n) => Number.isFinite(n) && n > 0);

    const userNameById = new Map<number, string>();
    if (userIds.length) {
      const { data, error: usersError } = await supabase.from("users").select("id, display_name").in("id", userIds);
      if (usersError) throw usersError;
      for (const row of data ?? []) userNameById.set(Number(row.id), row.display_name);
    }

    const customerNameById = new Map<number, string>();
    if (customerIds.length) {
      const { data, error: customersError } = await supabase.from("customers").select("id, name").in("id", customerIds);
      if (customersError) throw customersError;
      for (const row of data ?? []) customerNameById.set(Number(row.id), row.name);
    }

    const lineCount = new Map<number, number>();
    if (saleIds.length) {
      const { data, error: itemsError } = await supabase.from("sale_items").select("sale_id").in("sale_id", saleIds);
      if (itemsError) throw itemsError;
      for (const row of data ?? []) {
        const key = Number(row.sale_id);
        lineCount.set(key, (lineCount.get(key) ?? 0) + 1);
      }
    }

    const invoices = rows.map((row) => ({
      id: Number(row.id),
      invoice_number: row.invoice_number,
      total_amount: Number(row.total_amount ?? 0),
      discount: Number(row.discount ?? 0),
      notes: row.notes,
      sold_at: row.sold_at,
      seller_name: row.created_by ? (userNameById.get(Number(row.created_by)) ?? null) : null,
      customer_name: row.customer_id ? (customerNameById.get(Number(row.customer_id)) ?? null) : null,
      line_count: lineCount.get(Number(row.id)) ?? 0,
    }));

    return NextResponse.json({ success: true, invoices });
  } catch (error) {
    console.error("Invoices fetch from Supabase failed:", error);
    return NextResponse.json({ message: "دریافت فاکتورها ناموفق بود." }, { status: 500 });
  }
}

/**
 * ثبت فاکتور فروش — دادهٔ واقعی Supabase.
 *
 * کالاها و قیمت‌ها از Supabase خوانده می‌شوند و ثبت نهایی با RPC اتمیک
 * `record_sale` انجام می‌شود: درج هدر `sales` + اقلام `sale_items` +
 * کاهش `inventory_balances` + درج `stock_movements` همه در یک تراکنش.
 * اگر موجودی هر قلم کافی نباشد، کل عملیات rollback می‌شود.
 *
 * IDEMPOTENCY: کلاینت یک `requestId` می‌فرستد و شمارهٔ فاکتور از آن ساخته می‌شود.
 * ارسال دوبارهٔ همان درخواست به خطای یکتایی می‌خورد و فاکتور دوباره ثبت/کسر نمی‌شود.
 */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ message: "ابتدا وارد شوید." }, { status: 401 });

  try {
    const body = await request.json();
    const items = body.items as SaleLine[];
    const discount = Number(body.discount ?? 0);

    if (
      !Array.isArray(items) ||
      items.length < 1 ||
      items.length > 100 ||
      !Number.isSafeInteger(discount) ||
      discount < 0
    ) {
      return NextResponse.json({ message: "اقلام فاکتور یا تخفیف معتبر نیست." }, { status: 400 });
    }

    // ادغام بر اساس شناسهٔ واقعی واریانت (UUID)
    const normalized = new Map<string, number>();
    for (const item of items) {
      const variantId = typeof item.variantId === "string" ? item.variantId.trim() : "";
      const quantity = Number(item.quantity);
      if (
        !UUID_RE.test(variantId) ||
        !Number.isSafeInteger(quantity) ||
        quantity < 1 ||
        quantity > 100000
      ) {
        return NextResponse.json({ message: "تعداد یا کالای انتخاب‌شده معتبر نیست." }, { status: 400 });
      }
      normalized.set(variantId, (normalized.get(variantId) ?? 0) + quantity);
    }

    const supabase = supabaseAdmin();

    // مشتری انتخاب‌شده باید در Supabase وجود داشته باشد (شناسهٔ واقعی)
    let customerId: number | null = null;
    let customerName: string | null = null;
    if (body.customerId !== undefined && body.customerId !== null && body.customerId !== "") {
      const candidate = Number(body.customerId);
      if (!Number.isSafeInteger(candidate) || candidate <= 0) {
        return NextResponse.json({ message: "مشتری انتخاب‌شده معتبر نیست." }, { status: 400 });
      }
      const { data: customer } = await supabase.from("customers").select("id, name").eq("id", candidate).maybeSingle();
      if (!customer) return NextResponse.json({ message: "مشتری انتخاب‌شده معتبر نیست." }, { status: 400 });
      customerId = Number(customer.id);
      customerName = customer.name;
    }

    const variantIds = [...normalized.keys()];

    const { data: variants, error: variantsError } = await supabase
      .from("product_variants")
      .select(
        "id, product_id, variant_code, variant_label, sale_unit, sale_price_toman, purchase_price_toman",
      )
      .in("id", variantIds);
    if (variantsError) throw variantsError;

    const { data: balances, error: balancesError } = await supabase
      .from("inventory_balances")
      .select("variant_id, quantity")
      .in("variant_id", variantIds);
    if (balancesError) throw balancesError;

    const productIds = [...new Set((variants ?? []).map((v) => v.product_id))];
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, product_code, name")
      .in("id", productIds);
    if (productsError) throw productsError;

    const variantById = new Map((variants ?? []).map((v) => [v.id, v]));
    const productById = new Map((products ?? []).map((p) => [p.id, p]));
    const balanceByVariant = new Map((balances ?? []).map((b) => [b.variant_id, b]));

    const rows: {
      variant_id: string;
      quantity: number;
      unit_price: number;
      unit_cost: number;
      name: string;
      variant_label: string;
      sale_unit: string;
    }[] = [];

    for (const [id, quantity] of normalized) {
      const variant = variantById.get(id);
      if (!variant) {
        return NextResponse.json({ message: "کالای انتخاب‌شده پیدا نشد." }, { status: 400 });
      }
      const product = productById.get(variant.product_id);
      const stock = Number(balanceByVariant.get(id)?.quantity ?? 0);
      const label = product?.name ?? variant.variant_code;
      if (stock < quantity) {
        return NextResponse.json(
          { message: `موجودی «${label}» کافی نیست (موجودی فعلی: ${stock}).` },
          { status: 409 },
        );
      }
      rows.push({
        variant_id: id,
        quantity,
        unit_price: variant.sale_price_toman ?? 0,
        unit_cost: variant.purchase_price_toman ?? 0,
        name: label,
        variant_label: variant.variant_label ?? "",
        sale_unit: variant.sale_unit ?? "",
      });
    }

    const gross = rows.reduce((sum, row) => sum + row.unit_price * row.quantity, 0);
    if (discount > gross) {
      return NextResponse.json({ message: "مبلغ تخفیف از مبلغ فاکتور بیشتر است." }, { status: 400 });
    }
    const total = gross - discount;

    const rawPaid = body.paidAmount;
    const paid =
      rawPaid === undefined || rawPaid === null || rawPaid === "" ? total : Number(rawPaid);
    if (!Number.isSafeInteger(paid) || paid < 0 || paid > total) {
      return NextResponse.json(
        { message: "مبلغ پرداخت‌شده باید عدد صحیح بین صفر و مبلغ فاکتور باشد." },
        { status: 400 },
      );
    }

    // شمارهٔ فاکتور قطعی و یکتا بر اساس requestId (برای جلوگیری از ثبت دوباره در ارسال مجدد)
    const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
    const invoiceNumber = UUID_RE.test(requestId)
      ? `INV-${requestId}`
      : `INV-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    const { error: rpcError } = await supabase.rpc("record_sale", {
      p_invoice_number: invoiceNumber,
      p_channel: "in_store",
      p_discount: discount,
      p_notes: null,
      // شناسهٔ واقعی کاربر Supabase؛ در حالت مهمانِ localhost (بدون کاربر) صفر است و null فرستاده می‌شود.
      p_created_by: user.id > 0 ? user.id : null,
      p_customer_id: customerId, // شناسهٔ واقعی مشتری Supabase (یا null)
      p_paid_amount: paid,
      p_items: rows.map((row) => ({
        variant_id: row.variant_id,
        quantity: row.quantity,
        unit_price: row.unit_price,
        unit_cost: row.unit_cost,
      })),
    });

    const invoiceItems = rows.map((row) => ({
      name: row.name,
      variantLabel: row.variant_label,
      unit: row.sale_unit,
      quantity: row.quantity,
      unitPrice: row.unit_price,
      lineTotal: row.unit_price * row.quantity,
    }));

    if (rpcError) {
      const message = rpcError.message ?? "";

      // ارسال مجدد همان درخواست: فاکتور قبلی یکتاست → همان را موفق برگردان (بدون کسر دوباره)
      if (rpcError.code === "23505") {
        return NextResponse.json({
          success: true,
          duplicate: true,
          invoice: {
            invoiceNumber,
            total,
            discount,
            paid,
            remaining: total - paid,
            customerName,
            items: invoiceItems,
          },
        });
      }

      if (message.includes("INSUFFICIENT_STOCK")) {
        return NextResponse.json(
          { message: "موجودی یکی از اقلام کافی نیست؛ فاکتور ثبت نشد." },
          { status: 409 },
        );
      }
      if (message.includes("BAD_") || message.includes("INVALID_REASON") || message.includes("EMPTY_SALE")) {
        return NextResponse.json({ message: "اطلاعات فاکتور معتبر نیست." }, { status: 400 });
      }

      throw rpcError;
    }

    return NextResponse.json(
      {
        success: true,
        invoice: {
          invoiceNumber,
          total,
          discount,
          paid,
          remaining: total - paid,
          customerName,
          items: invoiceItems,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Sale recording failed:", error);
    return NextResponse.json(
      { message: "ثبت فاکتور انجام نشد." },
      { status: 500 },
    );
  }
}
