import { NextResponse } from "next/server";
import db from "@/lib/db";
import { currentUser } from "@/lib/auth";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ message: "ابتدا وارد شوید." }, { status: 401 });
  if (user.role !== "seller") return NextResponse.json({ message: "این گزارش ویژهٔ حساب فروشنده است." }, { status: 403 });

  const summary = db.prepare(`SELECT COUNT(*) AS invoice_count,
      COALESCE(SUM(total_amount),0) AS sales_total,
      COALESCE(SUM(discount),0) AS discounts
    FROM sales WHERE created_by=? AND date(sold_at)=date('now','localtime')`).get(user.id);
  const invoices = db.prepare(`SELECT invoice_number,total_amount,discount,sold_at
    FROM sales WHERE created_by=? AND date(sold_at)=date('now','localtime') ORDER BY id DESC`).all(user.id);
  const date = (db.prepare("SELECT date('now','localtime') AS day").get() as { day: string }).day;
  return NextResponse.json({ success: true, date, summary, invoices });
}
