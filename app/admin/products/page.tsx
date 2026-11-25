
"use client";

import { useCallback, useEffect, useState } from "react";
import StoreName from "@/components/store-name";

type Product = {
  product_id: string;
  product_code: string | null;
  name: string;
  category: string | null;
  description: string | null;
  image: string | null;
  old_price: number | null;
  variant_id: string | null;
  variant_code: string;
  variant_label: string | null;
  sale_unit: string | null;
  purchase_price: number | null;
  sale_price: number | null;
  stock: number | null;
};

const emptyForm = {
  name: "",
  variantLabel: "",
  saleUnit: "عدد",
  purchasePrice: "",
  salePrice: "",
  stock: "0",
  category: "",
  image: "",
  oldPrice: "",
  description: "",
};

const money = (value: number | null | undefined) =>
  `${new Intl.NumberFormat("fa-IR").format(value ?? 0)} تومان`;

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadProducts = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/products", {
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "دریافت کالاها ناموفق بود.");
      }

      setProducts(result.products);
      setError("");
    } catch {
      setError("دریافت فهرست کالاها ناموفق بود. اتصال برنامه را بررسی کن.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch("/api/auth").then((response) => response.json()).then((data) => {
      if (!data.user) window.location.href = "/admin/login";
      else if (data.user.role !== "admin") window.location.href = "/admin";
    });
    void loadProducts();
  }, [loadProducts]);

  function updateField(field: keyof typeof emptyForm, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  function startEditing(product: Product) {
    if (product.variant_id === null) {
      setError("برای این کالا تنوع قابل ویرایش وجود ندارد.");
      return;
    }

    setEditingProduct(product);
    setForm({
      name: product.name,
      variantLabel: product.variant_label ?? "",
      saleUnit: product.sale_unit ?? "",
      purchasePrice: String(product.purchase_price ?? 0),
      salePrice: String(product.sale_price ?? 0),
      stock: String(product.stock ?? 0),
      category: product.category ?? "",
      image: product.image ?? "",
      oldPrice: product.old_price === null || product.old_price === undefined ? "" : String(product.old_price),
      description: product.description ?? "",
    });
    setMessage("");
    setError("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEditing() {
    setEditingProduct(null);
    setForm(emptyForm);
    setMessage("");
    setError("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setSaving(true);

    try {
      const isEditing = editingProduct !== null;

      const response = await fetch("/api/products", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isEditing
            ? {
                productId: editingProduct.product_id,
                variantId: editingProduct.variant_id,
              }
            : {}),
          name: form.name.trim(),
          variantLabel: form.variantLabel.trim(),
          saleUnit: form.saleUnit.trim(),
          purchasePrice: Number(form.purchasePrice),
          salePrice: Number(form.salePrice),
          stock: Number(form.stock),
          category: form.category.trim(),
          image: form.image.trim(),
          oldPrice: form.oldPrice.trim() === "" ? null : Number(form.oldPrice),
          description: form.description.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "ذخیرهٔ اطلاعات ناموفق بود.");
      }

      if (isEditing) {
        setMessage(
          `اطلاعات «${form.name.trim()}» با موفقیت اصلاح شد.`,
        );
      } else {
        setMessage(
          `کالا با موفقیت ثبت شد. کد مدل جدید: ${result.code}`,
        );
      }

      setEditingProduct(null);
      setForm(emptyForm);
      await loadProducts();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "ذخیرهٔ اطلاعات ناموفق بود.",
      );
    } finally {
      setSaving(false);
    }
  }

  const modelCount = new Set(
    products.map((product) => product.product_id),
  ).size;

  return (
    <main className="products-page" dir="rtl">
      <header className="products-header">
        <div>
          <a className="back-link" href="/admin">
            ← بازگشت به داشبورد
          </a>
          <h1>کالاها و انبار</h1>
          <p>ثبت کالاها، قیمت‌ها و موجودی انبار (دادهٔ واقعی Supabase)</p>
        </div>

        <div className="products-count">
          <span>تعداد مدل‌ها</span>
          <strong>
            {new Intl.NumberFormat("fa-IR").format(modelCount)}
          </strong>
        </div>
      </header>

      <section className="products-panel">
        <div className="products-panel-heading">
          <div>
            <h2>{editingProduct ? "ویرایش کالا" : "ثبت کالای جدید"}</h2>
            <p>
              {editingProduct
                ? `کد مدل ${editingProduct.product_code} حفظ می‌شود. تغییرات را ذخیره کن.`
                : "کد مدل به‌صورت خودکار تولید می‌شود. مشخصات واریانت اختیاری است."}
            </p>
          </div>
        </div>

        <form className="product-form" onSubmit={handleSubmit}>
          {editingProduct && (
            <label>
              کد مدل
              <input value={editingProduct.product_code ?? ""} readOnly />
            </label>
          )}

          <label>
            نام مدل *
            <input
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="مثلاً شامپو نارگیل حاجی شاکر"
              required
              maxLength={150}
            />
          </label>

          <label>
            مشخصات واریانت (اختیاری)
            <input
              value={form.variantLabel}
              onChange={(event) => updateField("variantLabel", event.target.value)}
              placeholder="مثلاً بسته ۶ عددی"
              maxLength={80}
            />
          </label>

          <label>
            واحد فروش *
            <input
              value={form.saleUnit}
              onChange={(event) => updateField("saleUnit", event.target.value)}
              placeholder="مثلاً عدد یا باکس"
              required
              maxLength={50}
            />
          </label>

          <label>
            قیمت خرید (تومان) *
            <input
              type="number"
              min="0"
              step="1"
              value={form.purchasePrice}
              onChange={(event) =>
                updateField("purchasePrice", event.target.value)
              }
              required
            />
          </label>

          <label>
            قیمت فروش (تومان) *
            <input
              type="number"
              min="0"
              step="1"
              value={form.salePrice}
              onChange={(event) =>
                updateField("salePrice", event.target.value)
              }
              required
            />
          </label>

          <label>
            موجودی {editingProduct ? "فعلی" : "اولیه"} (بر اساس واحد فروش) *
            <input
              type="number"
              min="0"
              step="1"
              value={form.stock}
              onChange={(event) => updateField("stock", event.target.value)}
              required
            />
          </label>

          <label>
            دسته‌بندی فروشگاه
            <input
              value={form.category}
              onChange={(event) => updateField("category", event.target.value)}
              placeholder="مثلاً بهداشتی، شوینده، نوشیدنی، مواد غذایی"
              maxLength={50}
            />
          </label>

          <label>
            نشانی تصویر محصول
            <input
              dir="ltr"
              value={form.image}
              onChange={(event) => updateField("image", event.target.value)}
              placeholder="/images/products/001.jpeg"
              maxLength={300}
            />
          </label>

          <label>
            قیمت قبل از تخفیف (اختیاری)
            <input
              type="number"
              min="0"
              step="1"
              value={form.oldPrice}
              onChange={(event) => updateField("oldPrice", event.target.value)}
              placeholder="خالی = بدون تخفیف"
            />
          </label>

          <label style={{ gridColumn: "1 / -1" }}>
            توضیحات محصول
            <textarea
              value={form.description}
              onChange={(event) => updateField("description", event.target.value)}
              placeholder="توضیحات کامل محصول که در فروشگاه نمایش داده می‌شود"
              rows={3}
              maxLength={1000}
              style={{ width: "100%", minHeight: 72, padding: "10px 12px", border: "1px solid #dfe4dc", borderRadius: 9, background: "#fbfcfa", font: "inherit", fontWeight: 400 }}
            />
          </label>

          <div className="product-form-actions">
            <button type="submit" disabled={saving}>
              {saving
                ? "در حال ذخیره..."
                : editingProduct
                  ? "ذخیرهٔ تغییرات"
                  : "ثبت کالا"}
            </button>

            {editingProduct && (
              <button
                type="button"
                className="refresh-button"
                onClick={cancelEditing}
                disabled={saving}
              >
                انصراف
              </button>
            )}
          </div>
        </form>

        {message && <p className="product-message success">{message}</p>}
        {error && <p className="product-message error">{error}</p>}
      </section>

      <section className="products-panel">
        <div className="products-panel-heading">
          <div>
            <h2>فهرست کالاهای انبار</h2>
            <p>برای اصلاح مشخصات یا موجودی، روی «ویرایش» بزن.</p>
          </div>

          <button
            className="refresh-button"
            type="button"
            onClick={() => void loadProducts()}
            disabled={loading}
          >
            {loading ? "در حال دریافت..." : "به‌روزرسانی"}
          </button>
        </div>

        {loading ? (
          <p className="products-empty">در حال دریافت کالاها...</p>
        ) : products.length === 0 ? (
          <p className="products-empty">
            هنوز کالایی ثبت نشده است. از فرم بالا اولین کالا را برای <StoreName /> ثبت کنید.
          </p>
        ) : (
          <div className="products-table-wrap">
            <table className="products-table">
              <thead>
                <tr>
                  <th>کد مدل</th>
                  <th>نام مدل</th>
                  <th>مشخصات واریانت</th>
                  <th>واحد فروش</th>
                  <th>قیمت خرید</th>
                  <th>قیمت فروش</th>
                  <th>موجودی</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr
                    key={`${product.product_id}-${product.variant_id ?? "none"}`}
                  >
                    <td>{product.product_code || "—"}</td>
                    <td>{product.name}</td>
                    <td>{product.variant_label || "—"}</td>
                    <td>{product.sale_unit || "—"}</td>
                    <td>{product.purchase_price === null ? "—" : money(product.purchase_price)}</td>
                    <td>{money(product.sale_price)}</td>
                    <td>
                      <span
                        className={
                          (product.stock ?? 0) <= 2
                            ? "stock-badge low"
                            : "stock-badge"
                        }
                      >
                        {product.stock === null
                          ? "بدون رکورد"
                          : new Intl.NumberFormat("fa-IR").format(product.stock)}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="refresh-button"
                        onClick={() => startEditing(product)}
                        disabled={product.variant_id === null || saving}
                      >
                        ویرایش
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
