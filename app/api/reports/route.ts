import { NextResponse } from "next/server";
import db from "@/lib/db";
import { currentUser } from "@/lib/auth";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ message: "ابتدا وارد شوید." }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ message: "دسترسی گزارش فقط برای مدیر است." }, { status: 403 });
  const summary = db.prepare(`SELECT COUNT(*) AS invoice_count, COALESCE(SUM(total_amount),0) AS sales_total,
    COALESCE(SUM(discount),0) AS discounts FROM sales WHERE date(sold_at)=date('now','localtime')`).get();
  const profit = db.prepare(`SELECT COALESCE(SUM((si.unit_price-si.unit_cost)*si.quantity),0) AS gross_profit
    FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE date(s.sold_at)=date('now','localtime')`).get();
  const monthly = db.prepare(`SELECT strftime('%Y-%m',sold_at,'localtime') AS month, COUNT(*) AS invoices,
    SUM(total_amount) AS total FROM sales WHERE sold_at >= datetime('now','-5 months','start of month','localtime')
    GROUP BY strftime('%Y-%m',sold_at,'localtime') ORDER BY month`).all();
  const recent = db.prepare(`SELECT s.invoice_number,s.total_amount,s.sold_at,u.display_name AS seller_name
    FROM sales s LEFT JOIN users u ON u.id=s.created_by ORDER BY s.id DESC LIMIT 8`).all();
  return NextResponse.json({ success: true, summary: { ...summary as object, ...profit as object }, monthly, recent });
}
