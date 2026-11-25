"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StoreName from "@/components/store-name";

export default function LoginPage() {
  const router = useRouter();
  const [setup, setSetup] = useState(false);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { const skipStoreSetup = new URLSearchParams(window.location.search).get("skip-store-setup") === "1"; fetch("/api/store").then((r) => r.json()).then((store) => { if (store.setupRequired && store.adminRequired && !skipStoreSetup) { router.replace("/admin/setup"); return null; } return fetch("/api/auth").then((r) => r.json()); }).then((d) => { if (d) { if (d.user) router.replace("/"); setSetup(d.setupRequired); setChecked(true); } }).catch(() => setChecked(true)); }, [router]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const data = new FormData(event.currentTarget);
    const payload = { mode: setup ? "setup" : "login", username: data.get("username"), displayName: data.get("displayName"), password: data.get("password") };
    try { const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const result = await response.json(); if (!response.ok) throw new Error(result.message); router.replace("/"); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "ورود ناموفق بود."); } finally { setBusy(false); }
  }
  if (!checked) return <main className="auth-page"><div className="auth-card">در حال آماده‌سازی…</div></main>;
  return <main className="auth-page" dir="rtl"><form className="auth-card" onSubmit={submit}>
    <div className="brand-mark auth-mark">ف</div><p className="eyebrow"><StoreName /> · مدیریت فروشگاه</p>
    <h1>{setup ? "راه‌اندازی مدیر اصلی" : "ورود به فروشگاه"}</h1>
    <p className="muted">{setup ? "حساب مدیر را بسازید؛ این فرم فقط برای اولین راه‌اندازی نمایش داده می‌شود." : "برای ادامه نام کاربری و رمز عبورتان را وارد کنید."}</p>
    {setup && <label>نام نمایشی<input name="displayName" required placeholder="مدیر فروشگاه" /></label>}
    <label>نام کاربری<input name="username" required minLength={3} autoComplete="username" dir="ltr" placeholder="admin" /></label>
    <label>رمز عبور<input name="password" type="password" required minLength={10} autoComplete={setup ? "new-password" : "current-password"} dir="ltr" placeholder="حداقل ۱۰ نویسه" /></label>
    {error && <div className="notice error-notice">{error}</div>}
    <button className="primary-button full-button" disabled={busy}>{busy ? "لطفاً صبر کنید…" : setup ? "ساخت مدیر و شروع" : "ورود"}</button>
  </form></main>;
}
