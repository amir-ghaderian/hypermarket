"use client";

import Link from "next/link";
import StoreName from "@/components/store-name";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type InventoryItem = {
  product_id: string;
  product_code: string | null;
  product_name: string | null;
  category: string | null;
  subcategory: string | null;
  description: string | null;
  image: string | null;
  old_price: number | null;
  variant_id: string;
  variant_code: string;
  variant_label: string | null;
  sale_unit: string | null;
  purchase_price: number | null;
  sale_price: number | null;
  quantity: number | null;
  confirmed: boolean | null;
  has_balance: boolean;
};

type Counts = {
  products: number;
  variants: number;
  balances: number;
  variants_without_balance: number;
  zero_stock: number;
};

const money = (value: number | null) => `${new Intl.NumberFormat("fa-IR").format(value ?? 0)} تومان`;
const fa = (value: number) => new Intl.NumberFormat("fa-IR").format(value);
const PROJECT_IMAGE_DIR = "/images/products"; // پوشهٔ تصاویر پروژه داخل public

/** بندانگشتی ۴۰×۴۰ تصویر محصول با آیکون جانشین در صورت نبود/خرابی تصویر. */
function ProductThumb({ src, alt, onOpen }: { src: string | null; alt: string; onOpen: () => void }) {
  const [failed, setFailed] = useState(false);
  const hasImage = Boolean(src && src.trim()) && !failed;
  return (
    <button
      type="button"
      onClick={hasImage ? onOpen : undefined}
      disabled={!hasImage}
      aria-label={hasImage ? `نمایش بزرگ تصویر ${alt}` : `بدون تصویر: ${alt}`}
      title={hasImage ? "نمایش بزرگ تصویر" : "بدون تصویر"}
      style={{
        width: 40,
        height: 40,
        flex: "0 0 auto",
        padding: 0,
        border: "1px solid #e2e8e3",
        borderRadius: 8,
        overflow: "hidden",
        background: "#f6f8f6",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: hasImage ? "zoom-in" : "default",
      }}
    >
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src as string}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9aa8a0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      )}
    </button>
  );
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [canSeePurchase, setCanSeePurchase] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState({
    name: "",
    productCode: "",
    category: "",
    subcategory: "",
    description: "",
    image: "",
    variantCode: "",
    variantLabel: "",
    saleUnit: "",
    purchasePrice: "",
    salePrice: "",
    quantity: "",
  });
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [projectFiles, setProjectFiles] = useState<string[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/inventory", { cache: "no-store" });
      if (response.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message);
      setItems(data.items);
      setCounts(data.counts);
      setCanSeePurchase(Boolean(data.canSeePurchase));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "دریافت موجودی ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () =>
      items.filter((item) =>
        `${item.product_name ?? ""} ${item.product_code ?? ""} ${item.category ?? ""} ${
          item.variant_code
        } ${item.variant_label ?? ""} ${item.sale_unit ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [items, query],
  );

  const columnCount = (canSeePurchase ? 10 : 9) + 1;

  function statusOf(item: InventoryItem) {
    if (!item.has_balance) return "بدون رکورد موجودی";
    return item.confirmed ? "تأییدشده" : "تأییدنشده";
  }

  function startEditing(item: InventoryItem) {
    setEditing(item);
    setEditError("");
    setForm({
      name: item.product_name ?? "",
      productCode: item.product_code ?? "",
      category: item.category ?? "",
      subcategory: item.subcategory ?? "",
      description: item.description ?? "",
      image: item.image ?? "",
      variantCode: item.variant_code,
      variantLabel: item.variant_label ?? "",
      saleUnit: item.sale_unit ?? "",
      purchasePrice: String(item.purchase_price ?? 0),
      salePrice: String(item.sale_price ?? 0),
      quantity: String(item.quantity ?? 0),
    });
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    setEditError("");
    try {
      // تصویر: فقط مسیر نسبی داخل پوشهٔ public ارسال میشود؛ هیچ آپلودی انجام نمی‌گیرد.
      const imageValue = form.image.trim();
      const r = await fetch("/api/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: editing.product_id,
          variantId: editing.variant_id,
          name: form.name.trim(),
          productCode: form.productCode.trim(),
          category: form.category.trim(),
          subcategory: form.subcategory.trim(),
          description: form.description.trim(),
          image: imageValue,
          oldPrice: editing.old_price,
          variantCode: form.variantCode.trim(),
          variantLabel: form.variantLabel.trim(),
          saleUnit: form.saleUnit.trim(),
          purchasePrice: Number(form.purchasePrice),
          salePrice: Number(form.salePrice),
          stock: Number(form.quantity),
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.message);
      setEditing(null);
      await load();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "ذخیرهٔ تغییرات ناموفق بود.");
    } finally {
      setSaving(false);
    }
  }

  /** فهرست تصاویر موجود در پوشهٔ public پروژه را از سرور می‌گیرد (فقط خواندن، بدون آپلود). */
  async function loadProjectImages(force = false): Promise<string[]> {
    if (projectFiles.length && !force) return projectFiles;
    setFilesLoading(true);
    try {
      const r = await fetch(`/api/products/image?dir=${encodeURIComponent(PROJECT_IMAGE_DIR)}`);
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.message);
      const files: string[] = d.files ?? [];
      setProjectFiles(files);
      return files;
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "دریافت فهرست تصاویر پروژه ناموفق بود.");
      return [];
    } finally {
      setFilesLoading(false);
    }
  }

  function selectImagePath(path: string) {
    setUploadError("");
    setForm((f) => ({ ...f, image: path }));
  }

  /**
   * فایل انتخاب/رها‌شده فقط برای پیدا کردن همان فایل داخل پروژه استفاده می‌شود.
   * هیچ آپلودی انجام نمی‌گیرد؛ اگر چنین فایلی در پوشهٔ public پروژه نباشد، خطای واضح نشان داده می‌شود.
   */
  async function matchFileToProject(file: File | null | undefined) {
    if (!file) return;
    if (!/\.(jpe?g|png|webp)$/i.test(file.name)) {
      setUploadError("فرمت تصویر پشتیبانی نمی‌شود (jpg/jpeg/png/webp).");
      return;
    }
    const files = await loadProjectImages();
    const match = files.find((path) => path.split("/").pop()?.toLowerCase() === file.name.toLowerCase());
    if (!match) {
      setUploadError(`فایلی با نام «${file.name}» در ${PROJECT_IMAGE_DIR} پروژه پیدا نشد؛ ابتدا آن را در همین پوشه قرار دهید.`);
      return;
    }
    selectImagePath(match);
  }

  /** لغو انتخاب تصویر جدید؛ تصویر قبلی محصول بازگردانده می‌شود. */
  function cancelImageSelection() {
    if (!editing) return;
    setUploadError("");
    setForm((f) => ({ ...f, image: editing.image ?? "" }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <main className="app-shell" dir="rtl">
      <aside className="sidebar">
        <Link className="brand" href="/admin">
          <span className="brand-mark">ف</span>
          <span>
            <strong>
              <StoreName />
            </strong>
            <small>مدیریت فروشگاه</small>
          </span>
        </Link>
        <div className="menu-caption">انبار</div>
        <nav className="side-menu">
          <Link className="menu-item" href="/admin">
            ⌂ <span>داشبورد</span>
          </Link>
          <Link className="menu-item active" href="/admin/inventory">
            ♧ <span>بررسی موجودی</span>
          </Link>
        </nav>
      </aside>
      <section className="main-panel">
        <header className="topbar">
          <div>
            <div className="breadcrumb">فروشگاه / انبار</div>
            <h1>مدیریت کالا و موجودی</h1>
          </div>
          <Link className="text-link" href="/admin">
            بازگشت به داشبورد ←
          </Link>
        </header>
        <div className="dashboard-content">
          <section className="section-block">
            <div className="section-heading">
              <div>
                <h2>موجودی کالا</h2>
                <p>
                  دادهٔ واقعی Supabase؛ ویرایش کالا و موجودی از همین صفحه انجام می‌شود.
                  {counts
                    ? ` (${fa(counts.products)} محصول · ${fa(counts.variants)} واریانت · ${fa(
                        counts.balances,
                      )} رکورد موجودی)`
                    : ""}
                </p>
              </div>
              <button className="secondary-button" onClick={() => void load()}>
                به‌روزرسانی
              </button>
            </div>
            <input
              className="search-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="جستجوی نام، کد، دسته‌بندی، واریانت یا واحد…"
            />
            {error && <div className="notice error-notice">{error}</div>}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>کد محصول</th>
                    <th>نام محصول</th>
                    <th>دسته‌بندی</th>
                    <th>کد واریانت</th>
                    <th>مشخصات واریانت</th>
                    <th>واحد فروش</th>
                    {canSeePurchase && <th>قیمت خرید</th>}
                    <th>قیمت فروش</th>
                    <th>موجودی</th>
                    <th>وضعیت</th>
                    <th>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={columnCount}>در حال دریافت…</td>
                    </tr>
                  ) : (
                    filtered.map((item) => (
                      <tr key={item.variant_id}>
                        <td>{item.product_code || "—"}</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            <ProductThumb
                              src={item.image}
                              alt={item.product_name || "تصویر محصول"}
                              onOpen={() => item.image && setPreviewImage({ url: item.image, name: item.product_name || "" })}
                            />
                            <span>{item.product_name || "—"}</span>
                          </div>
                        </td>
                        <td>{item.category || "—"}</td>
                        <td dir="ltr">{item.variant_code}</td>
                        <td>{item.variant_label || "—"}</td>
                        <td>{item.sale_unit || "—"}</td>
                        {canSeePurchase && (
                          <td>{item.purchase_price === null ? "—" : money(item.purchase_price)}</td>
                        )}
                        <td>{item.sale_price === null ? "—" : money(item.sale_price)}</td>
                        <td>
                          <strong className={(item.quantity ?? 0) < 1 ? "stock-empty" : ""}>
                            {item.has_balance ? fa(item.quantity ?? 0) : "—"}
                          </strong>
                        </td>
                        <td>{statusOf(item)}</td>
                        <td>
                          {canSeePurchase ? (
                            <button type="button" className="secondary-button" onClick={() => startEditing(item)}>
                              ویرایش
                            </button>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={columnCount}>کالایی پیدا نشد.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {counts && (counts.variants_without_balance > 0 || counts.zero_stock > 0) && (
              <p className="muted" style={{ marginTop: 12 }}>
                {counts.variants_without_balance > 0
                  ? `${fa(counts.variants_without_balance)} واریانت بدون رکورد موجودی · `
                  : ""}
                {counts.zero_stock > 0 ? `${fa(counts.zero_stock)} واریانت با موجودی صفر` : ""}
              </p>
            )}
          </section>
        </div>
      </section>

      {editing && (
        <div className="modal-backdrop">
          <form className="modal-card" onSubmit={saveEdit}>
            <button type="button" className="modal-close" onClick={() => setEditing(null)}>×</button>
            <h2>ویرایش کالا</h2>
            <p className="muted">
              کد واریانت: <span dir="ltr">{editing.variant_code}</span> — تغییرات قیمت/واحد/موجودی فقط برای همین واریانت اعمال می‌شود.
            </p>

            <h3 style={{ marginTop: 12 }}>اطلاعات محصول</h3>
            <label>نام محصول *<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={150} /></label>
            <div className="form-grid">
              <label>کد محصول<input value={form.productCode} onChange={(e) => setForm({ ...form, productCode: e.target.value })} dir="ltr" maxLength={40} /></label>
              <label>دسته‌بندی<input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} maxLength={50} /></label>
              <label>زیردسته<input value={form.subcategory} onChange={(e) => setForm({ ...form, subcategory: e.target.value })} maxLength={50} /></label>
            </div>
            <label>توضیحات<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} maxLength={1000} style={{ width: "100%", minHeight: 70, padding: "10px 12px", border: "1px solid #dfe4dc", borderRadius: 9, background: "#fbfcfa", font: "inherit", fontWeight: 400 }} /></label>
            <div
              role="button"
              tabIndex={0}
              onClick={() => { setPickerOpen(true); void loadProjectImages(); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { setPickerOpen(true); void loadProjectImages(); } }}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => { e.preventDefault(); setDragActive(false); void matchFileToProject(e.dataTransfer.files?.[0]); }}
              style={{
                border: dragActive ? "2px dashed #2f7d54" : "2px dashed #cfd8d1",
                borderRadius: 12,
                padding: "16px 14px",
                textAlign: "center",
                cursor: "pointer",
                background: dragActive ? "#f1f8f3" : "#fbfcfa",
                marginTop: 8,
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                style={{ display: "none" }}
                onChange={(e) => { void matchFileToProject(e.target.files?.[0]); if (fileInputRef.current) fileInputRef.current.value = ""; }}
              />
              <strong>انتخاب تصویر از پوشهٔ public پروژه</strong>
              <div style={{ fontSize: 12, color: "#7a8a80", marginTop: 4 }}>
                برای دیدن تصاویر پروژه کلیک کن یا فایل را اینجا رها کن تا مسیر آن در پروژه پیدا شود — JPG / JPEG / PNG / WebP
              </div>
            </div>
            {pickerOpen && (
              <div style={{ border: "1px solid #e2e8e3", borderRadius: 12, padding: 10, marginTop: 8, background: "#fbfcfa" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  <span className="muted" style={{ fontSize: 12 }}>
                    تصاویر موجود در {PROJECT_IMAGE_DIR} ({fa(projectFiles.length)})
                  </span>
                  <button type="button" className="secondary-button" onClick={() => setPickerOpen(false)}>بستن</button>
                </div>
                {filesLoading ? (
                  <p className="muted" style={{ fontSize: 12 }}>در حال دریافت…</p>
                ) : projectFiles.length ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 220, overflowY: "auto" }}>
                    {projectFiles.map((path) => (
                      <button
                        key={path}
                        type="button"
                        title={path}
                        onClick={() => { selectImagePath(path); setPickerOpen(false); }}
                        style={{
                          width: 56,
                          height: 56,
                          padding: 0,
                          overflow: "hidden",
                          background: "#fff",
                          cursor: "pointer",
                          border: form.image === path ? "2px solid #2f7d54" : "1px solid #e2e8e3",
                          borderRadius: 8,
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={path} alt={path} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="muted" style={{ fontSize: 12 }}>تصویری در این پوشه نیست.</p>
                )}
              </div>
            )}
            {form.image && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.image} alt="پیش‌نمایش تصویر" style={{ maxHeight: 120, borderRadius: 10, border: "1px solid #eee" }} />
                <span className="muted" style={{ fontSize: 12 }}>
                  {form.image === (editing?.image ?? "") ? "تصویر فعلی محصول" : "مسیر انتخاب‌شده (پس از ذخیره ثبت می‌شود)"}
                </span>
                {form.image !== (editing?.image ?? "") && (
                  <button type="button" className="secondary-button" onClick={cancelImageSelection} disabled={saving}>
                    لغو انتخاب تصویر
                  </button>
                )}
              </div>
            )}
            <label>
              مسیر نسبی تصویر داخل public (همین مقدار در products.image ذخیره می‌شود)
              <input
                value={form.image}
                onChange={(e) => setForm({ ...form, image: e.target.value })}
                dir="ltr"
                placeholder="/images/products/001.jpeg"
                maxLength={300}
              />
            </label>
            {uploadError && <div className="notice error-notice">{uploadError}</div>}
            <p className="muted" style={{ fontSize: 12 }}>
              تصاویر روی فایل‌سیستم پروژه (پوشهٔ public) نگهداری می‌شوند و فقط مسیر نسبی مانند /images/products/001.jpeg در products.image ذخیره می‌گردد؛ هیچ تصویری به Supabase Storage آپلود نمی‌شود. اگر فایل در public نباشد، ذخیره متوقف و خطا نمایش داده می‌شود.
            </p>

            <h3 style={{ marginTop: 12 }}>اطلاعات واریانت</h3>
            <div className="form-grid">
              <label>کد واریانت<input value={form.variantCode} onChange={(e) => setForm({ ...form, variantCode: e.target.value })} dir="ltr" maxLength={80} /></label>
              <label>مشخصات واریانت<input value={form.variantLabel} onChange={(e) => setForm({ ...form, variantLabel: e.target.value })} maxLength={80} /></label>
              <label>واحد فروش *<input value={form.saleUnit} onChange={(e) => setForm({ ...form, saleUnit: e.target.value })} required maxLength={50} /></label>
              <label>قیمت خرید (تومان) *<input type="number" min="0" step="1" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} required /></label>
              <label>قیمت فروش (تومان) *<input type="number" min="0" step="1" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value })} required /></label>
              <label>تعداد موجودی *<input type="number" min="0" step="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required /></label>
            </div>
            <p className="muted" style={{ fontSize: 12 }}>
              تغییر موجودی از طریق RPC «adjust_inventory» انجام و در «stock_movements» با مقدار قبلی/جدید ثبت می‌شود.
            </p>

            {editError && <div className="notice error-notice">{editError}</div>}
            <div className="modal-actions">
              <button type="submit" className="primary-button" disabled={saving}>{saving ? "در حال ذخیره…" : "ذخیرهٔ تغییرات"}</button>
              <button type="button" className="secondary-button" onClick={() => setEditing(null)} disabled={saving}>انصراف</button>
            </div>
          </form>
        </div>
      )}

      {previewImage && (
        <div
          className="modal-backdrop"
          onClick={() => setPreviewImage(null)}
          role="dialog"
          aria-modal="true"
          aria-label="پیش‌نمایش تصویر محصول"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "90vw",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              cursor: "default",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewImage.url}
              alt={previewImage.name || "تصویر محصول"}
              style={{
                maxWidth: "90vw",
                maxHeight: "78vh",
                objectFit: "contain",
                borderRadius: 14,
                background: "#fff",
                padding: 8,
                boxShadow: "0 18px 50px rgba(0,0,0,.35)",
              }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#fff", textAlign: "center" }}>
              <span style={{ fontSize: 13 }}>{previewImage.name}</span>
              <button type="button" className="secondary-button" onClick={() => setPreviewImage(null)}>
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
