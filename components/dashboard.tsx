"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@/lib/auth";
import StoreName from "@/components/store-name";

type Report = { summary: { invoice_count: number; sales_total: number; gross_profit: number; discounts: number }; monthly: { month: string; invoices: number; total: number }[]; recent: { invoice_number: string; total_amount: number; sold_at: string; seller_name: string }[] };
type DailyReport = { date: string; summary: { invoice_count: number; sales_total: number; discounts: number }; invoices: { invoice_number: string; total_amount: number; discount: number; sold_at: string }[] };
const money = (amount = 0) => `${new Intl.NumberFormat("fa-IR").format(amount)} تومان`;

export default function Dashboard({ user }: { user: User }) {
  const [report, setReport] = useState<Report | null>(null);
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [dailyOpen, setDailyOpen] = useState(false);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyError, setDailyError] = useState("");
  useEffect(() => { if (user.role === "admin") fetch("/api/reports").then((r) => r.ok ? r.json() : null).then((data) => data?.success && setReport(data)); }, [user.role]);
  async function logout() { await fetch("/api/auth", { method: "DELETE" }); window.location.href = "/admin/login"; }
  async function showDailyReport() {
    setDailyOpen(true); setDailyLoading(true); setDailyError("");
    try { const response = await fetch("/api/reports/daily", { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.message); setDailyReport(data); }
    catch (error) { setDailyError(error instanceof Error ? error.message : "گزارش روزانه دریافت نشد."); }
    finally { setDailyLoading(false); }
  }
  function downloadDailyCsv() {
    if (!dailyReport) return;
    const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = [["شماره فاکتور", "زمان", "تخفیف (تومان)", "مبلغ نهایی (تومان)"], ...dailyReport.invoices.map((invoice) => [invoice.invoice_number, new Date(invoice.sold_at).toLocaleString("fa-IR"), invoice.discount, invoice.total_amount])];
    const blob = new Blob(["\uFEFF" + rows.map((row) => row.map(quote).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `daily-sales-${dailyReport.date}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }
  return <main className="app-shell" dir="rtl"><aside className="sidebar">
    <Link className="brand" href="/admin"><span className="brand-mark">ف</span><span><strong><StoreName /></strong><small>مدیریت فروشگاه</small></span></Link>
    <div className="menu-caption">مدیریت فروشگاه</div><nav className="side-menu">
      <Link className="menu-item active" href="/admin">⌂ <span>داشبورد</span></Link>
      <Link className="menu-item" href="/admin/sales">＋ <span>فروش جدید</span></Link>
      <Link className="menu-item" href="/admin/inventory">♧ <span>بررسی موجودی</span></Link>
      <Link className="menu-item" href="/admin/customers">☺ <span>مشتریان</span></Link>
      {user.role === "admin" && <><Link className="menu-item" href="/admin/invoices">▤ <span>فاکتورها</span></Link><Link className="menu-item" href="/admin/products">⚙ <span>ویرایش کالا و موجودی</span></Link><Link className="menu-item" href="/admin/users">♙ <span>مدیریت کاربران</span></Link><Link className="menu-item" href="/admin/setup?edit=1">✎ <span>مشخصات فروشگاه</span></Link></>}
    </nav><div className="sidebar-bottom"><div className="store-status"><span className="status-dot"/><div><strong>{user.display_name}</strong><small>{user.role === "admin" ? "مدیر" : "فروشنده"}</small></div></div><button className="logout-button" onClick={logout}>خروج از حساب</button></div>
  </aside><section className="main-panel"><header className="topbar"><div><div className="breadcrumb">فروشگاه / داشبورد</div><h1>داشبورد مدیریت</h1></div><div className="topbar-left"><span className="local-badge">{user.role === "admin" ? "مدیر" : "فروشنده"}</span><span className="user-chip">{user.display_name}</span></div></header>
    <div className="dashboard-content"><section className="welcome-banner"><div className="welcome-copy"><span className="eyebrow"><StoreName /> · مدیریت فروشگاه</span><h2>سلام {user.display_name}</h2><p>{user.role === "admin" ? "وضعیت فروش و عملکرد فروشگاه را ببینید." : "برای شروع، یک فاکتور فروش ثبت کنید."}</p><Link className="primary-button" href="/admin/sales">ثبت فروش جدید ←</Link></div><div className="welcome-decoration"><span className="decoration-circle circle-one"/><span className="decoration-circle circle-two"/><span className="decoration-letter">ف</span></div></section>
    {user.role === "admin" ? <><section className="section-block"><div className="section-heading"><div><h2>عملکرد امروز</h2><p>مبالغ بر اساس فروش ثبت‌شده</p></div></div><div className="stats-grid"><article className="stat-card"><div className="stat-icon">↗</div><p>فروش امروز</p><strong className="stat-value">{money(report?.summary.sales_total)}</strong></article><article className="stat-card"><div className="stat-icon">▤</div><p>فاکتور امروز</p><strong className="stat-value">{new Intl.NumberFormat("fa-IR").format(report?.summary.invoice_count ?? 0)}</strong></article><article className="stat-card"><div className="stat-icon">◈</div><p>سود ناخالص امروز</p><strong className="stat-value">{money(report?.summary.gross_profit)}</strong></article><article className="stat-card"><div className="stat-icon">٪</div><p>تخفیف امروز</p><strong className="stat-value">{money(report?.summary.discounts)}</strong></article></div></section>
      <section className="section-block"><div className="section-heading"><div><h2>فاکتورهای اخیر</h2><p>تا ۸ فاکتور آخر</p></div><Link className="text-link" href="/admin/sales">ثبت فاکتور جدید ←</Link></div><div className="table-wrap"><table><thead><tr><th>شماره فاکتور</th><th>فروشنده</th><th>زمان</th><th>مبلغ</th></tr></thead><tbody>{report?.recent.map((invoice) => <tr key={invoice.invoice_number}><td>{invoice.invoice_number}</td><td>{invoice.seller_name ?? "—"}</td><td>{new Date(invoice.sold_at).toLocaleString("fa-IR")}</td><td>{money(invoice.total_amount)}</td></tr>)}{report?.recent.length === 0 && <tr><td colSpan={4}>هنوز فاکتوری ثبت نشده است.</td></tr>}</tbody></table></div></section>
      <section className="section-block"><div className="section-heading"><div><h2>فروش ماهانه</h2><p>مجموع ماه‌های اخیر</p></div></div><div className="table-wrap"><table><thead><tr><th>ماه</th><th>تعداد فاکتور</th><th>مجموع فروش</th></tr></thead><tbody>{report?.monthly.map((row) => <tr key={row.month}><td>{row.month}</td><td>{new Intl.NumberFormat("fa-IR").format(row.invoices)}</td><td>{money(row.total)}</td></tr>)}</tbody></table></div></section>
    </> : <><section className="section-block"><div className="section-heading"><div><h2>دسترسی سریع فروشنده</h2><p>فروش، معرفی کالا و بررسی موجودی قابل دسترسی است؛ تغییر موجودی فقط با مدیر است.</p></div></div><div className="shortcuts-grid"><Link className="shortcut-card" href="/admin/sales"><span className="shortcut-icon">＋</span><span className="shortcut-copy"><strong>ثبت فاکتور جدید</strong><small>انتخاب کالا و صدور فاکتور</small></span><span className="shortcut-arrow">←</span></Link><Link className="shortcut-card" href="/admin/sales?new-product=1"><span className="shortcut-icon">♧</span><span className="shortcut-copy"><strong>ثبت کالای جدید</strong><small>معرفی کالا؛ موجودی اولیه صفر می‌ماند</small></span><span className="shortcut-arrow">←</span></Link><Link className="shortcut-card" href="/admin/inventory"><span className="shortcut-icon">▣</span><span className="shortcut-copy"><strong>بررسی موجودی</strong><small>مشاهدهٔ موجودی بدون امکان ویرایش</small></span><span className="shortcut-arrow">←</span></Link><button className="shortcut-card shortcut-button" onClick={showDailyReport}><span className="shortcut-icon">▤</span><span className="shortcut-copy"><strong>صورت‌حساب فروش امروز</strong><small>فقط فاکتورهای ثبت‌شده با حساب تو</small></span><span className="shortcut-arrow">←</span></button></div></section>
      {dailyOpen && <section className="section-block"><div className="section-heading"><div><h2>صورت‌حساب امروز من</h2><p>گزارش امروز فقط شامل فروش‌های ثبت‌شده با حساب شماست.</p></div><div className="report-actions"><button className="secondary-button" onClick={showDailyReport}>به‌روزرسانی</button><button className="secondary-button" onClick={downloadDailyCsv} disabled={!dailyReport}>دریافت فایل CSV</button><button className="text-button" onClick={() => setDailyOpen(false)}>بستن</button></div></div>{dailyError && <div className="notice error-notice">{dailyError}</div>}{dailyLoading ? <div className="empty-state">در حال دریافت گزارش…</div> : dailyReport && <><div className="stats-grid daily-stats"><article className="stat-card"><p>مجموع فروش امروز</p><strong className="stat-value">{money(dailyReport.summary.sales_total)}</strong></article><article className="stat-card"><p>تعداد فاکتورها</p><strong className="stat-value">{new Intl.NumberFormat("fa-IR").format(dailyReport.summary.invoice_count)}</strong></article><article className="stat-card"><p>مجموع تخفیف</p><strong className="stat-value">{money(dailyReport.summary.discounts)}</strong></article></div><div className="table-wrap"><table><thead><tr><th>شماره فاکتور</th><th>زمان</th><th>تخفیف</th><th>مبلغ نهایی</th></tr></thead><tbody>{dailyReport.invoices.map((invoice) => <tr key={invoice.invoice_number}><td>{invoice.invoice_number}</td><td>{new Date(invoice.sold_at).toLocaleString("fa-IR")}</td><td>{money(invoice.discount)}</td><td>{money(invoice.total_amount)}</td></tr>)}{dailyReport.invoices.length === 0 && <tr><td colSpan={4}>امروز هنوز فاکتوری با حساب شما ثبت نشده است.</td></tr>}</tbody></table></div></>}</section>}
    </>}
    <footer className="app-footer"><span><StoreName /> · مدیریت فروشگاه</span><span>اطلاعات محلی فروشگاه</span></footer></div></section></main>;
}
