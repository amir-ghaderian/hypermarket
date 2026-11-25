import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveProductImage } from "@/lib/product-image";

function validAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

/** تولید کد محصول بعدی به شکل K-### با بررسی یکتایی روی Supabase. */
async function generateProductCode(existing: Set<string>): Promise<string> {
  let maxNumber = 0;
  for (const code of existing) {
    const match = /^K-(\d+)$/.exec(code);
    if (match) maxNumber = Math.max(maxNumber, Number(match[1]));
  }
  let next = maxNumber + 1;
  let code = `K-${String(next).padStart(3, "0")}`;
  while (existing.has(code)) {
    next += 1;
    code = `K-${String(next).padStart(3, "0")}`;
  }
  return code;
}

/** فهرست محصولات/واریانت‌ها با موجودی، از Supabase. */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ message: "ابتدا وارد شوید." }, { status: 401 });

  try {
    const supabase = supabaseAdmin();
    const [productsResult, variantsResult, balancesResult] = await Promise.all([
      supabase.from("products").select("id, product_code, name, category, subcategory, description, image, old_price"),
      supabase.from("product_variants").select("id, product_id, variant_code, variant_label, sale_unit, purchase_price_toman, sale_price_toman"),
      supabase.from("inventory_balances").select("variant_id, quantity, quantity_confirmed"),
    ]);
    if (productsResult.error) throw productsResult.error;
    if (variantsResult.error) throw variantsResult.error;
    if (balancesResult.error) throw balancesResult.error;

    const productById = new Map((productsResult.data ?? []).map((p) => [p.id, p]));
    const balanceByVariant = new Map((balancesResult.data ?? []).map((b) => [b.variant_id, b]));
    const isAdmin = user.role === "admin";

    const products = (variantsResult.data ?? [])
      .map((variant) => {
        const product = productById.get(variant.product_id);
        const balance = balanceByVariant.get(variant.id);
        return {
          product_id: variant.product_id,
          product_code: product?.product_code ?? null,
          name: product?.name ?? variant.variant_code,
          category: product?.category ?? null,
          subcategory: product?.subcategory ?? null,
          description: product?.description ?? null,
          image: product?.image ?? null,
          old_price: product?.old_price ?? null,
          variant_id: variant.id,
          variant_code: variant.variant_code,
          variant_label: variant.variant_label,
          sale_unit: variant.sale_unit,
          purchase_price: isAdmin ? (variant.purchase_price_toman ?? null) : null,
          sale_price: variant.sale_price_toman ?? null,
          stock: balance ? Number(balance.quantity ?? 0) : null,
        };
      })
      .sort((a, b) => (a.product_code ?? "").localeCompare(b.product_code ?? "") || a.variant_code.localeCompare(b.variant_code));

    return NextResponse.json({ success: true, products });
  } catch (error) {
    console.error("Products fetch from Supabase failed:", error);
    return NextResponse.json({ success: false, message: "دریافت کالاها ناموفق بود." }, { status: 500 });
  }
}

/** افزودن محصول جدید (به‌همراه یک واریانت). */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ message: "ابتدا وارد شوید." }, { status: 401 });
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim().slice(0, 150);
    const variantLabel = String(body.variantLabel ?? "").trim().slice(0, 80);
    const saleUnit = String(body.saleUnit ?? "").trim().slice(0, 50);

    const purchasePrice = user.role === "admin" ? validAmount(body.purchasePrice) : 0;
    const salePrice = validAmount(body.salePrice);
    const stock = user.role === "admin" ? validAmount(body.stock) : 0;
    const oldPrice = validAmount(body.oldPrice);

    if (!name) return NextResponse.json({ success: false, message: "نام مدل الزامی است." }, { status: 400 });
    if (!saleUnit) return NextResponse.json({ success: false, message: "واحد فروش الزامی است (مثلاً عدد)." }, { status: 400 });
    if (purchasePrice === null || salePrice === null || stock === null) {
      return NextResponse.json({ success: false, message: "قیمت‌ها و تعداد باید عدد صحیح و غیرمنفی باشند." }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const { data: codes, error: codesError } = await supabase.from("products").select("product_code");
    if (codesError) throw codesError;
    const existingCodes = new Set((codes ?? []).map((r) => String(r.product_code)));
    const code = await generateProductCode(existingCodes);

    const now = new Date().toISOString();
    const productId = randomUUID();
    const variantId = randomUUID();

    // فقط مسیر نسبی تصویر داخل پوشهٔ public ذخیره می‌شود؛ هیچ آپلودی به Storage انجام نمی‌گیرد.
    const resolvedImage = await resolveProductImage(body.image);
    if ("error" in resolvedImage) {
      return NextResponse.json({ success: false, message: resolvedImage.error }, { status: 400 });
    }

    const { error: productError } = await supabase.from("products").insert({
      id: productId,
      product_code: code,
      name,
      category: String(body.category ?? "").trim().slice(0, 50) || null,
      subcategory: String(body.subcategory ?? "").trim().slice(0, 50) || null,
      description: String(body.description ?? "").trim().slice(0, 1000) || null,
      image: resolvedImage.value,
      old_price: oldPrice,
      created_at: now,
      updated_at: now,
    });
    if (productError) throw productError;

    const { error: variantError } = await supabase.from("product_variants").insert({
      id: variantId,
      product_id: productId,
      variant_code: `${code}|${saleUnit}`,
      variant_label: variantLabel || saleUnit,
      sale_unit: saleUnit,
      purchase_price_toman: user.role === "admin" ? purchasePrice : 0,
      sale_price_toman: salePrice,
      created_at: now,
    });
    if (variantError) {
      await supabase.from("products").delete().eq("id", productId);
      throw variantError;
    }

    // موجودی اولیه فقط اگر مقدار مثبت داده شده باشد (با ثبت گردش 'opening').
    if (stock > 0) {
      const { error: stockError } = await supabase.rpc("adjust_inventory", {
        p_variant_id: variantId,
        p_delta: stock,
        p_reason: "opening",
        p_reference: code,
        p_note: "موجودی اولیه هنگام ثبت کالا",
      });
      if (stockError) throw stockError;
    }

    return NextResponse.json({ success: true, message: "کالا با موفقیت ثبت شد.", productId, variantId, code }, { status: 201 });
  } catch (error) {
    console.error("Product creation failed:", error);
    return NextResponse.json({ success: false, message: "ثبت کالا انجام نشد." }, { status: 500 });
  }
}

/** ویرایش محصول/واریانت (فقط مدیر). */
export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ message: "ابتدا وارد شوید." }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ message: "فقط مدیر اجازهٔ ویرایش کالا را دارد." }, { status: 403 });
  try {
    const body = await request.json();
    const productId = String(body.productId ?? "").trim();
    const variantId = String(body.variantId ?? "").trim();
    const name = String(body.name ?? "").trim().slice(0, 150);
    const productCode = String(body.productCode ?? "").trim().slice(0, 40);
    const subcategory = String(body.subcategory ?? "").trim().slice(0, 50);
    const variantCode = String(body.variantCode ?? "").trim().slice(0, 80);
    const variantLabel = String(body.variantLabel ?? "").trim().slice(0, 80);
    const saleUnit = String(body.saleUnit ?? "").trim().slice(0, 50);
    const purchasePrice = validAmount(body.purchasePrice);
    const salePrice = validAmount(body.salePrice);
    const stock = validAmount(body.stock);
    const oldPrice = validAmount(body.oldPrice);

    if (!productId || !variantId) {
      return NextResponse.json({ success: false, message: "شناسهٔ کالا معتبر نیست." }, { status: 400 });
    }
    if (!name) return NextResponse.json({ success: false, message: "نام مدل الزامی است." }, { status: 400 });
    if (!saleUnit) return NextResponse.json({ success: false, message: "واحد فروش الزامی است." }, { status: 400 });
    if (purchasePrice === null || salePrice === null || stock === null) {
      return NextResponse.json({ success: false, message: "قیمت‌ها و تعداد باید عدد صحیح و غیرمنفی باشند." }, { status: 400 });
    }
    if (productCode && !/^[A-Za-z0-9._-]{1,40}$/.test(productCode)) {
      return NextResponse.json({ success: false, message: "کد محصول معتبر نیست." }, { status: 400 });
    }

    // تصویر: فقط مسیر نسبی داخل پوشهٔ public (با بررسی وجود واقعی فایل) ذخیره می‌شود؛
    // در صورت نامعتبر بودن مسیر، هیچ تغییری روی محصول اعمال نمی‌شود.
    const resolvedImage = await resolveProductImage(body.image);
    if ("error" in resolvedImage) {
      return NextResponse.json({ success: false, message: resolvedImage.error }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const { data: variant, error: variantLookupError } = await supabase
      .from("product_variants")
      .select("id, product_id")
      .eq("id", variantId)
      .eq("product_id", productId)
      .maybeSingle();
    if (variantLookupError) throw variantLookupError;
    if (!variant) return NextResponse.json({ success: false, message: "کالای موردنظر پیدا نشد." }, { status: 404 });

    // یکتایی کد محصول (بدون تغییر دادن سایر رکوردها)
    if (productCode) {
      const { data: clash } = await supabase.from("products").select("id").eq("product_code", productCode).neq("id", productId).maybeSingle();
      if (clash) return NextResponse.json({ success: false, message: "این کد محصول قبلاً استفاده شده است." }, { status: 409 });
    }

    const productPatch: Record<string, unknown> = {
      name,
      category: String(body.category ?? "").trim().slice(0, 50) || null,
      subcategory: subcategory || null,
      description: String(body.description ?? "").trim().slice(0, 1000) || null,
      image: resolvedImage.value,
      old_price: oldPrice,
      updated_at: new Date().toISOString(),
    };
    if (productCode) productPatch.product_code = productCode;

    const { error: productUpdateError } = await supabase.from("products").update(productPatch).eq("id", productId);
    if (productUpdateError) throw productUpdateError;

    const variantPatch: Record<string, unknown> = {
      variant_label: variantLabel || saleUnit,
      sale_unit: saleUnit,
      purchase_price_toman: purchasePrice,
      sale_price_toman: salePrice,
    };
    if (variantCode) variantPatch.variant_code = variantCode;

    const { error: variantUpdateError } = await supabase.from("product_variants").update(variantPatch).eq("id", variantId);
    if (variantUpdateError) {
      if (variantUpdateError.code === "23505") {
        return NextResponse.json({ success: false, message: "این کد واریانت قبلاً استفاده شده است." }, { status: 409 });
      }
      throw variantUpdateError;
    }

    // تعدیل موجودی فقط از طریق RPC و با ثبت گردش 'manual' (مقدار قبلی/جدید قابل پیگیری در stock_movements).
    const { data: balance, error: balanceError } = await supabase
      .from("inventory_balances")
      .select("quantity")
      .eq("variant_id", variantId)
      .maybeSingle();
    if (balanceError) throw balanceError;
    const current = Number(balance?.quantity ?? 0);
    const delta = stock - current;
    if (delta !== 0) {
      const { error: adjustError } = await supabase.rpc("adjust_inventory", {
        p_variant_id: variantId,
        p_delta: delta,
        p_reason: "manual",
        p_reference: variantId,
        p_note: `ویرایش دستی موجودی: ${current} → ${stock}`,
      });
      if (adjustError) throw adjustError;
    }

    return NextResponse.json({ success: true, message: "اطلاعات کالا با موفقیت اصلاح شد." });
  } catch (error) {
    console.error("Product update failed:", error);
    return NextResponse.json({ success: false, message: "اصلاح اطلاعات کالا انجام نشد." }, { status: 500 });
  }
}
