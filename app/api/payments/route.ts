import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

const clean = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ message: "ابتدا وارد شوید." }, { status: 401 });
  try {
    const body = await request.json();
    const customerId = Number(body.customerId);
    const amount = Number(body.amount);
    const method = String(body.method ?? "");
    const notes = clean(body.notes, 500);
    const paidAt = clean(body.paidAt, 10);

    if (!Number.isSafeInteger(customerId) || customerId < 1) {
      return NextResponse.json({ message: "مشتری انتخاب‌شده معتبر نیست." }, { status: 400 });
    }
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return NextResponse.json({ message: "مبلغ پرداخت باید عدد صحیح و بیشتر از صفر باشد." }, { status: 400 });
    }
    if (method !== "cash" && method !== "card") {
      return NextResponse.json({ message: "روش پرداخت باید نقدی یا کارت‌به‌کارت باشد." }, { status: 400 });
    }
    if (paidAt && !/^\d{4}-\d{2}-\d{2}$/.test(paidAt)) {
      return NextResponse.json({ message: "تاریخ پرداخت معتبر نیست." }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const { data: customer } = await supabase.from("customers").select("id").eq("id", customerId).maybeSingle();
    if (!customer) return NextResponse.json({ message: "مشتری پیدا نشد." }, { status: 404 });

    const row: Record<string, unknown> = {
      customer_id: customerId,
      amount,
      method,
      notes: notes || null,
      created_by: user.id > 0 ? user.id : null,
    };
    if (paidAt) row.paid_at = `${paidAt}T12:00:00.000Z`;

    const { error } = await supabase.from("payments").insert(row);
    if (error) throw error;

    const [salesResult, paymentsResult] = await Promise.all([
      supabase.from("sales").select("total_amount, paid_amount").eq("customer_id", customerId),
      supabase.from("payments").select("amount").eq("customer_id", customerId),
    ]);
    if (salesResult.error) throw salesResult.error;
    if (paymentsResult.error) throw paymentsResult.error;

    const totalSales = (salesResult.data ?? []).reduce((sum, r) => sum + Number(r.total_amount ?? 0), 0);
    const totalPaid =
      (salesResult.data ?? []).reduce((sum, r) => sum + Number(r.paid_amount ?? 0), 0) +
      (paymentsResult.data ?? []).reduce((sum, r) => sum + Number(r.amount ?? 0), 0);

    return NextResponse.json({ success: true, balance: totalSales - totalPaid }, { status: 201 });
  } catch (error) {
    console.error("Payment creation failed:", error);
    return NextResponse.json({ message: "ثبت پرداخت انجام نشد." }, { status: 500 });
  }
}
