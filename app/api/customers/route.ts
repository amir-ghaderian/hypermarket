import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

const clean = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ message: "ابتدا وارد شوید." }, { status: 401 });
  const q = clean(new URL(request.url).searchParams.get("q"), 100);

  try {
    const supabase = supabaseAdmin();
    const [customersResult, salesResult, paymentsResult] = await Promise.all([
      supabase.from("customers").select("id, name, phone, notes, created_at").order("id", { ascending: false }).limit(500),
      supabase.from("sales").select("customer_id, total_amount, paid_amount").not("customer_id", "is", null),
      supabase.from("payments").select("customer_id, amount"),
    ]);
    if (customersResult.error) throw customersResult.error;
    if (salesResult.error) throw salesResult.error;
    if (paymentsResult.error) throw paymentsResult.error;

    const salesByCustomer = new Map<number, { total: number; paid: number }>();
    for (const row of salesResult.data ?? []) {
      const key = Number(row.customer_id);
      const current = salesByCustomer.get(key) ?? { total: 0, paid: 0 };
      current.total += Number(row.total_amount ?? 0);
      current.paid += Number(row.paid_amount ?? 0);
      salesByCustomer.set(key, current);
    }
    const paymentsByCustomer = new Map<number, number>();
    for (const row of paymentsResult.data ?? []) {
      const key = Number(row.customer_id);
      paymentsByCustomer.set(key, (paymentsByCustomer.get(key) ?? 0) + Number(row.amount ?? 0));
    }

    const needle = q.toLowerCase();
    const customers = (customersResult.data ?? [])
      .filter((row) => !needle || (row.name ?? "").toLowerCase().includes(needle) || (row.phone ?? "").toLowerCase().includes(needle))
      .map((row) => {
        const sales = salesByCustomer.get(Number(row.id)) ?? { total: 0, paid: 0 };
        const totalSales = sales.total;
        const totalPaid = sales.paid + (paymentsByCustomer.get(Number(row.id)) ?? 0);
        return { ...row, total_sales: totalSales, total_paid: totalPaid, balance: totalSales - totalPaid };
      });

    return NextResponse.json({ success: true, customers });
  } catch (error) {
    console.error("Customers fetch failed:", error);
    return NextResponse.json({ message: "دریافت فهرست مشتریان ناموفق بود." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ message: "ابتدا وارد شوید." }, { status: 401 });
  try {
    const body = await request.json();
    const name = clean(body.name, 150);
    const phone = clean(body.phone, 50);
    const notes = clean(body.notes, 500);
    if (name.length < 2) return NextResponse.json({ message: "نام مشتری الزامی است." }, { status: 400 });

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("customers")
      .insert({ name, phone: phone || null, notes: notes || null })
      .select("id")
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, id: Number(data.id) }, { status: 201 });
  } catch (error) {
    console.error("Customer creation failed:", error);
    return NextResponse.json({ message: "ثبت مشتری انجام نشد." }, { status: 500 });
  }
}
