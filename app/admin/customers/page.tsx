"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import StoreName from "@/components/store-name";

type Customer = { id: number; name: string; phone: string | null; notes: string | null; balance: number };

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", notes: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load(q = query) {
    setLoading(true);
    try {
      const r = await fetch(`/api/customers?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      if (r.status === 401) { location.href = "/admin/login"; return; }
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      setCustomers(d.customers);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "دریافت فهرست مشتریان ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load("");
    fetch("/api/auth").then((r) => r.json()).then((d) => {
      if (!d.user) { location.href = "/admin/login"; return; }
      setIsAdmin(d.user.role === "admin");
    }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startEditing(customer: Customer) {
    setEditingId(customer.id);
    setForm({ name: customer.name, phone: customer.phone ?? "", notes: customer.notes ?? "" });
    setMessage(""); setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEditing() { setEditingId(null); setForm({ name: "", phone: "", notes: "" }); setMessage(""); setError(""); }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage(""); setBusy(true);
    try {
      const r = await fetch(editingId ? `/api/customers/${editingId}` : "/api/customers", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      setMessage(editingId ? "اطلاعات مشتری ویرایش شد." : "مشتری جدید ثبت شد.");
      setEditingId(null); setForm({ name: "", phone: "", notes: "" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیرهٔ مشتری ناموفق بود.");
    } finally { setBusy(false); }
  }

  async function remove(customer: Customer) {
    if (!window.confirm(`مشتری «${customer.name}» حذف شود؟`)) return;
    setError(""); setMessage("");
    const r = await fetch(`/api/customers/${customer.id}`, { method: "DELETE" });
    const d = await r.json();
    if (!r.ok) { setError(d.message); return; }
    setMessage("مشتری حذف شد.");
    await load();
  }

  const money = (value = 0) => `${new Intl.NumberFormat("fa-IR").format(value)} تومان`;
  const fa = (value: number) => new Intl.NumberFormat("fa-IR").format(value);

  return <main className="app-shell" dir="rtl"><aside className="sidebar"><Link className="brand" href="/admin"><span className="brand-mark">ف</span><span><strong><StoreName /></strong><small>مدیریت فروشگاه</small></span></Link><div className="menu-caption">حساب مشتریان</div><nav className="side-menu"><Link className="menu-item" href="/admin">⌂ <span>داشبورد</span></Link><Link className="menu-item active" href="/admin/customers">☺ <span>مشتریان</span></Link></nav></aside>
    <section className="main-panel"><header className="topbar"><div><div className="breadcrumb">فروشگاه / مشتریان</div><h1>مدیریت مشتریان</h1></div><Link className="text-link" href="/admin">بازگشت به داشبورد ←</Link></header>
      <div className="admin-layout">
        <form className="admin-form" onSubmit={submit}>
          <h2>{editingId ? "ویرایش مشتری" : "افزودن مشتری"}</h2>
          <p className="muted">نام مشتری الزامی است؛ شماره تماس و توضیحات اختیاری‌اند.</p>
          <label>نام مشتری<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={150} placeholder="مثلاً مریم احمدی"/></label>
          <label>شماره تماس<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={50} dir="ltr" placeholder="09xxxxxxxxx"/></label>
          <label>توضیحات<input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={500} placeholder="یادداشت اختیاری"/></label>
          {error && <div className="notice error-notice">{error}</div>}
          {message && <div className="notice success-notice">{message}</div>}
          <button className="primary-button full-button" disabled={busy}>{busy ? "لطفاً صبر کنید…" : editingId ? "ذخیرهٔ تغییرات" : "ثبت مشتری"}</button>
          {editingId && <button type="button" className="secondary-button full-button" onClick={cancelEditing}>انصراف</button>}
        </form>
        <section className="staff-list">
          <div className="section-heading"><div><h2>فهرست مشتریان</h2><p>{fa(customers.length)} مشتری</p></div><button type="button" className="secondary-button" onClick={() => void load()}>به‌روزرسانی</button></div>
          <input className="search-input" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void load(); }} placeholder="جستجوی نام یا شماره تماس…"/>
          <div className="table-wrap"><table><thead><tr><th>نام</th><th>شماره تماس</th><th>مانده حساب</th><th>عملیات</th></tr></thead><tbody>
            {loading ? <tr><td colSpan={4}>در حال دریافت…</td></tr> : customers.map((customer) => <tr key={customer.id}>
              <td>{customer.name}</td>
              <td dir="ltr">{customer.phone || "—"}</td>
              <td className={customer.balance > 0 ? "stock-empty" : ""}>{money(customer.balance)}</td>
              <td><div className="report-actions"><Link className="secondary-button" href={`/customers/${customer.id}`}>صورت‌حساب</Link><button type="button" className="secondary-button" onClick={() => startEditing(customer)}>ویرایش</button>{isAdmin && <button type="button" className="secondary-button" onClick={() => void remove(customer)}>حذف</button>}</div></td>
            </tr>)}
            {!loading && customers.length === 0 && <tr><td colSpan={4}>مشتری‌ای پیدا نشد.</td></tr>}
          </tbody></table></div>
        </section>
      </div>
    </section>
  </main>;
}
