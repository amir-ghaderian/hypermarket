"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function StoreSetupPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [includePhone, setIncludePhone] = useState(false);
  const [includeAddress, setIncludeAddress] = useState(false);
  const [profile, setProfile] = useState({ storeType: "", products: "", storeName: "", phone: "", address: "" });
  const [editing, setEditing] = useState(false);
  const [canSkip, setCanSkip] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const editRequested = new URLSearchParams(window.location.search).get("edit") === "1";
    fetch("/api/store").then((response) => response.json()).then((data) => {
      const isAdmin = data.user?.role === "admin";
      if (data.setupRequired && data.adminRequired) {
        setCanSkip(true);
        setChecked(true);
      } else if (isAdmin && (data.setupRequired || editRequested)) {
        setProfile(data.store);
        setIncludePhone(Boolean(data.store.phone));
        setIncludeAddress(Boolean(data.store.address));
        setEditing(true);
        setChecked(true);
      } else {
        router.replace(data.user ? "/" : "/admin/login");
      }
    }).catch(() => setChecked(true));
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    const body = {
      storeType: form.get("storeType"),
      products: form.get("products"),
      storeName: form.get("storeName"),
      phone: includePhone ? form.get("phone") : "",
      address: includeAddress ? form.get("address") : "",
    };
    try {
      const response = await fetch("/api/store", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      router.replace(editing ? "/" : "/admin/login"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ذخیرهٔ اطلاعات فروشگاه ناموفق بود."); }
    finally { setBusy(false); }
  }

  if (!checked) return <main className="auth-page"><div className="auth-card">در حال بررسی راه‌اندازی…</div></main>;
  return <main className="auth-page" dir="rtl"><form className="auth-card setup-card" onSubmit={submit}>
    <div className="brand-mark auth-mark">ف</div><p className="eyebrow">{editing ? "مدیریت مشخصات فروشگاه" : "راه‌اندازی فروشگاه · مرحلهٔ اول از ۲"}</p>
    <h1>{editing ? "مشخصات فروشگاه" : "فروشگاهتان را معرفی کنید"}</h1>
    <p className="muted">{editing ? "اطلاعات پایه را تغییر دهید؛ تلفن و نشانی فقط در صورت انتخاب روی فاکتور چاپ می‌شوند." : "این مرحله اختیاری است. اطلاعات در دیتابیس محلی همین نسخه ذخیره می‌شوند و نام فروشگاه در برنامه و فاکتور می‌آید."}</p>
    <label>نوع فروشگاه<select name="storeType" required defaultValue={profile.storeType}><option value="" disabled>انتخاب کنید</option><option value="grocery">سوپرمارکت و خواربار</option><option value="hypermarket">هایپرمارکت</option><option value="clothing">پوشاک</option><option value="pharmacy">داروخانه</option><option value="other">سایر</option></select></label>
    <label>چه کالاهایی می‌فروشید؟<input name="products" required maxLength={200} defaultValue={profile.products} placeholder="مثلاً مواد غذایی، شوینده و نوشیدنی" /></label>
    <label>نام فروشگاه<input name="storeName" required minLength={2} maxLength={120} defaultValue={profile.storeName} placeholder="مثلاً فروشگاه بهار" /></label>
    <fieldset className="optional-fields"><legend>اطلاعات اختیاری فاکتور</legend>
      <label className="check-row"><input type="checkbox" checked={includePhone} onChange={(event) => setIncludePhone(event.target.checked)} /> شماره تماس روی فاکتور درج شود</label>
      {includePhone && <label>شماره تماس<input name="phone" type="tel" dir="ltr" defaultValue={profile.phone} placeholder="مثلاً ۰۲۱۱۲۳۴۵۶۷۸" /></label>}
      <label className="check-row"><input type="checkbox" checked={includeAddress} onChange={(event) => setIncludeAddress(event.target.checked)} /> نشانی روی فاکتور درج شود</label>
      {includeAddress && <label>نشانی فروشگاه<textarea name="address" rows={3} maxLength={250} defaultValue={profile.address} placeholder="نشانی که می‌خواهید روی فاکتور چاپ شود" /></label>}
    </fieldset>
    {error && <div className="notice error-notice">{error}</div>}
    <button className="primary-button full-button" disabled={busy}>{busy ? "در حال ذخیره…" : editing ? "ذخیرهٔ مشخصات" : "ذخیره و رفتن به ساخت حساب مدیر"}</button>
    {canSkip && <button type="button" className="secondary-button full-button" onClick={() => router.replace("/admin/login?skip-store-setup=1")}>رد کردن و ادامه به ساخت حساب مدیر</button>}
    {editing && <button type="button" className="secondary-button full-button" onClick={() => router.replace("/")}>انصراف</button>}
  </form></main>;
}
