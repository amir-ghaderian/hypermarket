import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

const clean = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);

type LedgerRow = { type: "sale" | "payment"; id: number; title: string; notes: string | null; date: string; debit: number; credit: number };

async function readId(params: Promise<{ id: string }>) {
  const id = Number((await params).id);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ message: "ابتدا وارد شوید." }, { status: 401 });
  const id = await readId(params);
  if (!id) return NextResponse.json({ message: "شناسهٔ مشتری معتبر نیست." }, { status: 400 });

  try {
    const supabase = supabaseAdmin();
    const [customerResult, salesResult, paymentsResult] = await Promise.all([
      supabase.from("customers").select("id, name, phone, notes, created_at").eq("id", id).maybeSingle(),
      supabase.from("sales").select("id, invoice_number, total_amount, paid_amount, sold_at").eq("customer_id", id).order("sold_at", { ascending: true }).order("id", { ascending: true }),
      supabase.from("payments").select("id, amount, method, notes, paid_at").eq("customer_id", id).order("paid_at", { ascending: true }).order("id", { ascending: true }),
    ]);
    if (customerResult.error) throw customerResult.error;
    if (salesResult.error) throw salesResult.error;
    if (paymentsResult.error) throw paymentsResult.error;
    if (!customerResult.data) return NextResponse.json({ message: "مشتری پیدا نشد." }, { status: 404 });

    const ledger: LedgerRow[] = [
      ...(salesResult.data ?? []).map((sale): LedgerRow => ({
        type: "sale",
        id: Number(sale.id),
        title: `فاکتور فروش ${sale.invoice_number}`,
        notes: null,
        date: sale.sold_at,
        debit: Number(sale.total_amount ?? 0),
        credit: Number(sale.paid_amount ?? 0),
      })),
      ...(paymentsResult.data ?? []).map((payment): LedgerRow => ({
        type: "payment",
        id: Number(payment.id),
        title: payment.method === "card" ? "پرداخت کارت‌به‌کارت" : "پرداخت نقدی",
        notes: payment.notes,
        date: payment.paid_at,
        debit: 0,
        credit: Number(payment.amount ?? 0),
      })),
    ].sort((a, b) => (a.date === b.date ? a.id - b.id : a.date < b.date ? -1 : 1));

    let running = 0;
    const rows = ledger.map((row) => {
      running += row.debit - row.credit;
      return { ...row, balance: running };
    });
    const totalDebit = rows.reduce((sum, row) => sum + row.debit, 0);
    const totalCredit = rows.reduce((sum, row) => sum + row.credit, 0);

    return NextResponse.json({ success: true, customer: customerResult.data, ledger: rows, summary: { totalDebit, totalCredit, balance: totalDebit - totalCredit } });
  } catch (error) {
    console.error("Customer statement failed:", error);
    return NextResponse.json({ message: "دریافت صورت‌حساب ناموفق بود." }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ message: "ابتدا وارد شوید." }, { status: 401 });
  const id = await readId(params);
  if (!id) return NextResponse.json({ message: "شناسهٔ مشتری معتبر نیست." }, { status: 400 });
  try {
    const body = await request.json();
    const name = clean(body.name, 150);
    const phone = clean(body.phone, 50);
    const notes = clean(body.notes, 500);
    if (name.length < 2) return NextResponse.json({ message: "نام مشتری الزامی است." }, { status: 400 });

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("customers")
      .update({ name, phone: phone || null, notes: notes || null })
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ message: "مشتری پیدا نشد." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Customer update failed:", error);
    return NextResponse.json({ message: "ویرایش مشتری انجام نشد." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ message: "ابتدا وارد شوید." }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ message: "فقط مدیر اجازهٔ حذف مشتری را دارد." }, { status: 403 });
  const id = await readId(params);
  if (!id) return NextResponse.json({ message: "شناسهٔ مشتری معتبر نیست." }, { status: 400 });
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase.from("customers").delete().eq("id", id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ message: "مشتری پیدا نشد." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Customer delete failed:", error);
    return NextResponse.json({ message: "حذف مشتری انجام نشد." }, { status: 500 });
  }
}
