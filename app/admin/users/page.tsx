"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import StoreName from "@/components/store-name";

type Staff = {
  id: number;
  username: string;
  display_name: string;
  role: string;
  active: boolean;
  created_at: string;
};

export default function AdminPage() {
  const [users, setUsers] = useState<Staff[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<Staff | null>(null);
  const [editError, setEditError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch("/api/users");
    if (r.status === 401) { location.href = "/admin/login"; return; }
    if (r.status === 403) { location.href = "/admin"; return; }
    const d = await r.json();
    setUsers(d.users ?? []);
  }
  useEffect(() => { void load(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    const r = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: form.get("username"), displayName: form.get("displayName"), password: form.get("password") }),
    });
    const d = await r.json();
    if (!r.ok) { setError(d.message); return; }
    setMessage("حساب فروشنده ساخته شد.");
    event.currentTarget.reset();
    await load();
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setEditError(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const r = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing.id,
          displayName: form.get("displayName"),
          role: form.get("role"),
          active: form.get("active") === "on",
          password: String(form.get("password") ?? ""),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      setEditing(null);
      setMessage("اطلاعات کاربر ذخیره شد.");
      await load();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "ویرایش کاربر انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="app-shell" dir="rtl"><aside className="sidebar"><Link className="brand" href="/admin"><span className="brand-mark">ف</span><span><strong><StoreName /></strong><small>مدیریت فروشگاه</small></span></Link><div className="menu-caption">مدیریت</div><nav className="side-menu"><Link className="menu-item" href="/admin">⌂ <span>داشبورد</span></Link><Link className="menu-item active" href="/admin/users">⚙ <span>کاربران</span></Link></nav></aside><section className="main-panel"><header className="topbar"><div><div className="breadcrumb">مدیریت / کاربران</div><h1>مدیریت کاربران</h1></div><Link className="text-link" href="/admin">بازگشت ←</Link></header><div className="admin-layout"><form className="admin-form" onSubmit={submit}><h2>ساخت حساب فروشنده</h2><p className="muted">فروشنده فاکتور صادر می‌کند و کالای جدید معرفی می‌کند. مشاهدهٔ گزارش و ویرایش قبلی‌ها برای او بسته است.</p><label>نام نمایشی<input name="displayName" required placeholder="مثلاً علی رضایی"/></label><label>نام کاربری<input name="username" required minLength={3} dir="ltr" placeholder="seller01"/></label><label>رمز عبور اولیه<input name="password" type="password" required minLength={10} dir="ltr" placeholder="حداقل ۱۰ نویسه"/></label>{error && <div className="notice error-notice">{error}</div>}{message && <div className="notice success-notice">{message}</div>}<button className="primary-button full-button">ساخت حساب</button></form><section className="staff-list"><div className="section-heading"><div><h2>حساب‌های فعال</h2><p>{new Intl.NumberFormat("fa-IR").format(users.length)} کاربر</p></div></div><div className="table-wrap"><table><thead><tr><th>نام</th><th>نام کاربری</th><th>نقش</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>{users.map((u) => <tr key={u.id}><td>{u.display_name}</td><td dir="ltr">{u.username}</td><td>{u.role === "admin" ? "مدیر" : "فروشنده"}</td><td>{u.active ? "فعال" : "غیرفعال"}</td><td><button type="button" className="secondary-button" onClick={() => { setEditing(u); setEditError(""); }}>ویرایش</button></td></tr>)}{users.length === 0 && <tr><td colSpan={5}>هنوز کاربری ثبت نشده است.</td></tr>}</tbody></table></div></section></div></section>
    {editing && <div className="modal-backdrop"><form className="modal-card" onSubmit={saveEdit}><button type="button" className="modal-close" onClick={() => setEditing(null)}>×</button><h2>ویرایش کاربر</h2><p className="muted">نام کاربری: <span dir="ltr">{editing.username}</span></p><label>نام نمایشی<input name="displayName" defaultValue={editing.display_name} required /></label><div className="form-grid"><label>نقش<select name="role" defaultValue={editing.role}><option value="admin">مدیر</option><option value="seller">فروشنده</option></select></label><label>وضعیت<select name="active" defaultValue={editing.active ? "on" : "off"}><option value="on">فعال</option><option value="off">غیرفعال</option></select></label></div><label>رمز عبور جدید (خالی = بدون تغییر)<input name="password" type="password" minLength={10} dir="ltr" placeholder="حداقل ۱۰ نویسه"/></label>{editError && <div className="notice error-notice">{editError}</div>}<button className="primary-button full-button" disabled={busy}>{busy ? "در حال ذخیره…" : "ذخیرهٔ تغییرات"}</button></form></div>}
  </main>;
}
