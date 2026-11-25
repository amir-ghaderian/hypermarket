"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import StoreName from "@/components/store-name";

type Customer = { id: number; name: string; phone: string | null; notes: string | null; created_at: string };
type LedgerRow = { type: "sale" | "payment"; id: number; title: string; notes: string | null; date: string; debit: number; credit: number; balance: number };
type Statement = { customer: Customer; ledger: LedgerRow[]; summary: { totalDebit: number; totalCredit: number; balance: number } };
type Method = "cash" | "card";

const money = (value = 0) => `${new Intl.NumberFormat("fa-IR").format(value)} تومان`;
const fa = (value: number) => new Intl.NumberFormat("fa-IR").format(value);
const when = (value: string) => new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z").toLocaleString("fa-IR");

function StatementView() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [data, setData] = useState<Statement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [payError, setPayError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/customers/${id}`, { cache: "no-store" });
      if (r.status === 401) { location.href = "/admin/login"; return; }
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      setData(d);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "دریافت صورت‌حساب ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPayError(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const r = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: Number(id),
          amount: Number(form.get("amount")),
          method: form.get("method"),
          paidAt: form.get("paidAt") || undefined,
          notes: form.get("notes"),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      setPayOpen(false);
      await load();
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "ثبت پرداخت ناموفق بود.");
    } finally { setBusy(false); }
  }

  const balance = data?.summary.balance ?? 0;

  return <main className="app-shell" dir="rtl"><aside className="sidebar"><Link className="brand" href="/admin"><span className="brand-mark">ف</span><span><strong><StoreName /></strong><small>مدیریت فروشگاه</small></span></Link><div className="menu-caption">حساب مشتریان</div><nav className="side-menu"><Link className="menu-item" href="/admin">⌂ <span>داشبورد</span></Link><Link className="menu-item active" href="/admin/customers">☺ <span>مشتریان</span></Link></nav></aside>
    <section className="main-panel"><header className="topbar"><div><div className="breadcrumb">مشتریان / صورت‌حساب</div><h1>{data ? data.customer.name : "صورت‌حساب مشتری"}</h1></div><Link className="text-link" href="/admin/customers">بازگشت به مشتریان ←</Link></header>
      <div className="dashboard-content">
        {loading ? <div className="empty-state">در حال دریافت…</div> : error ? <div className="notice error-notice">{error}</div> : data && <>
          <section className="stats-grid">
            <article className="stat-card"><p>مجموع بدهکار (فروش)</p><strong className="stat-value">{money(data.summary.totalDebit)}</strong></article>
            <article className="stat-card"><p>مجموع بستانکار (پرداخت)</p><strong className="stat-value">{money(data.summary.totalCredit)}</strong></article>
            <article className="stat-card"><p>مانده حساب</p><strong className="stat-value">{money(balance)}</strong></article>
            <article className="stat-card"><p>تعداد تراکنش</p><strong className="stat-value">{fa(data.ledger.length)}</strong></article>
          </section>
          <section className="section-block">
            <div className="section-heading"><div><h2>اطلاعات مشتری</h2><p>{data.customer.phone ? `تلفن: ${data.customer.phone}` : "شماره تماس ثبت نشده"}{data.customer.notes ? ` — ${data.customer.notes}` : ""}</p></div><div className="report-actions"><button type="button" className="primary-button" onClick={() => setPayOpen(true)}>＋ ثبت پرداخت</button><button type="button" className="secondary-button" onClick={() => void load()}>به‌روزرسانی</button></div></div>
            <div className="table-wrap"><table><thead><tr><th>تاریخ</th><th>شرح</th><th>بدهکار</th><th>بستانکار</th><th>مانده</th></tr></thead><tbody>
              {data.ledger.map((row) => <tr key={`${row.type}-${row.id}`}>
                <td>{when(row.date)}</td>
                <td>{row.title}{row.notes ? ` — ${row.notes}` : ""}</td>
                <td>{row.debit ? money(row.debit) : "—"}</td>
                <td>{row.credit ? money(row.credit) : "—"}</td>
                <td className={row.balance > 0 ? "stock-empty" : ""}>{money(row.balance)}</td>
              </tr>)}
              {data.ledger.length === 0 && <tr><td colSpan={5}>هنوز فاکتور یا پرداختی برای این مشتری ثبت نشده است.</td></tr>}
            </tbody></table></div>
          </section>
        </>}
      </div>
    </section>
    {payOpen && <div className="modal-backdrop"><form className="modal-card" onSubmit={recordPayment}><button type="button" className="modal-close" onClick={() => setPayOpen(false)}>×</button><h2>ثبت پرداخت مشتری</h2><p className="muted">مانده فعلی حساب: {money(balance)}</p><label>مبلغ پرداخت (تومان)<input name="amount" type="number" min="1" required/></label><div className="form-grid"><label>روش پرداخت<select name="method" defaultValue="cash"><option value="cash">نقدی</option><option value="card">کارت‌به‌کارت</option></select></label><label>تاریخ پرداخت<input name="paidAt" type="date"/></label></div><label>توضیحات<input name="notes" maxLength={500} placeholder="اختیاری"/></label>{payError && <div className="notice error-notice">{payError}</div>}<button className="primary-button full-button" disabled={busy}>{busy ? "در حال ثبت…" : "ثبت پرداخت"}</button></form></div>}
  </main>;
}

export default function CustomerStatementPage() {
  return <Suspense fallback={<main className="app-shell" dir="rtl"><div className="empty-state">در حال بارگذاری…</div></main>}><StatementView /></Suspense>;
}
