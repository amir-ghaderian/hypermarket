"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import StoreName from "@/components/store-name";

// کالا و موجودی از Supabase (همان منبع صفحهٔ موجودی)
type Product = {
  variant_id: string;
  product_code: string | null;
  product_name: string | null;
  category: string | null;
  variant_label: string | null;
  sale_unit: string | null;
  sale_price: number | null;
  quantity: number | null;
  has_balance: boolean;
};
type CartLine = { product: Product; quantity: number };
type InvoiceItem = {
  name: string;
  variantLabel: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};
type Invoice = {
  invoiceNumber: string;
  total: number;
  discount: number;
  paid: number;
  remaining: number;
  customerName: string | null;
  items: InvoiceItem[];
};
type StoreInfo = { storeName: string; phone: string; address: string };
type Customer = { id: number; name: string; phone: string | null; balance: number };

const money = (v: number) => `${new Intl.NumberFormat("fa-IR").format(v)} تومان`;
const fa = (v: number) => new Intl.NumberFormat("fa-IR").format(v);

function newRequestId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-4${Math.random()
    .toString(16)
    .slice(2, 6)}`;
}

export default function SalesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState("0");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [store, setStore] = useState<StoreInfo>({ storeName: "فروشگاه", phone: "", address: "" });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [paid, setPaid] = useState("");
  // یک شناسهٔ یکتا برای هر تلاش ثبت؛ تا موفقیت ثابت می‌ماند تا ارسال مجدد، فاکتور را دوباره ثبت نکند.
  const requestIdRef = useRef<string>(newRequestId());

  async function load() {
    const r = await fetch("/api/inventory", { cache: "no-store" });
    if (r.status === 401) {
      location.href = "/admin/login";
      return;
    }
    const d = await r.json();
    if (r.ok && d.success) setProducts(d.items);
    else setError(d.message);
  }

  useEffect(() => {
    void load();
    if (new URLSearchParams(window.location.search).get("new-product") === "1") setAddOpen(true);
    fetch("/api/store").then((response) => response.json()).then((data) => { if (data.store) setStore(data.store); }).catch(() => undefined);
    fetch("/api/customers").then((response) => response.json()).then((data) => { if (data.customers) setCustomers(data.customers); }).catch(() => undefined);
  }, []);

  const filtered = useMemo(
    () =>
      products.filter((p) =>
        p.variant_id &&
        `${p.product_name ?? ""} ${p.product_code ?? ""} ${p.category ?? ""} ${p.variant_label ?? ""} ${
          p.sale_unit ?? ""
        }`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [products, query],
  );

  const subtotal = cart.reduce((sum, line) => sum + (line.product.sale_price ?? 0) * line.quantity, 0);
  const total = Math.max(0, subtotal - Number(discount || 0));

  function add(product: Product) {
    if (!product.variant_id) return;
    setCart((rows) => {
      const row = rows.find((item) => item.product.variant_id === product.variant_id);
      if (row) {
        return rows.map((item) =>
          item.product.variant_id === product.variant_id
            ? { ...item, quantity: Math.min(item.quantity + 1, product.quantity ?? 0) }
            : item,
        );
      }
      // مقدار پیش‌فرض هر ردیف = ۱ (واحد بر اساس sale_unit همان واریانت)
      return [...rows, { product, quantity: 1 }];
    });
  }

  function qty(id: string, amount: number) {
    setCart((rows) =>
      rows.map((row) =>
        row.product.variant_id === id
          ? { ...row, quantity: Math.max(1, Math.min(row.quantity + amount, row.product.quantity ?? 0)) }
          : row,
      ),
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const r = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((l) => ({ variantId: l.product.variant_id, quantity: l.quantity })),
          discount: Number(discount),
          customerId: customerId || null,
          paidAmount: customerId ? Number(paid === "" ? total : paid) : undefined,
          requestId: requestIdRef.current,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      setInvoice(d.invoice);
      setCart([]);
      setDiscount("0");
      setCustomerId("");
      setPaid("");
      requestIdRef.current = newRequestId();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت فاکتور ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    const r = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.get("name"), variantLabel: form.get("variantLabel"), saleUnit: form.get("saleUnit"), salePrice: Number(form.get("salePrice")), stock: 0 }),
    });
    const d = await r.json();
    if (!r.ok) {
      setError(d.message);
      return;
    }
    setAddOpen(false);
    await load();
  }

  return <main className="app-shell" dir="rtl"><aside className="sidebar"><Link className="brand" href="/admin"><span className="brand-mark">ف</span><span><strong><StoreName /></strong><small>مدیریت فروشگاه</small></span></Link><div className="menu-caption">فروش</div><nav className="side-menu"><Link className="menu-item" href="/admin">⌂ <span>داشبورد</span></Link><Link className="menu-item active" href="/admin/sales">＋ <span>فاکتور جدید</span></Link></nav></aside>
    <section className="main-panel"><header className="topbar"><div><div className="breadcrumb">فروشگاه / فروش</div><h1>صدور فاکتور فروش</h1></div><Link className="text-link" href="/admin">بازگشت به داشبورد ←</Link></header><div className="sales-layout"><section className="sales-products"><div className="section-heading"><div><h2>انتخاب کالا</h2><p>جستجو بر اساس نام، کد، دسته‌بندی، واریانت یا واحد</p></div><button type="button" className="secondary-button" onClick={() => setAddOpen(true)}>＋ کالای جدید</button></div><input className="search-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جستجوی کالا…"/><div className="product-pick-list">{filtered.map((p) => <button type="button" className="product-pick" key={p.variant_id} onClick={() => add(p)} disabled={(p.quantity ?? 0) < 1}><span><strong>{p.product_name || "—"}</strong><small>{p.product_code || "—"} · {p.variant_label || "—"} · {p.sale_unit || "—"}</small></span><span className="pick-meta"><b>{money(p.sale_price ?? 0)}</b><small>موجودی {fa(p.quantity ?? 0)} {p.sale_unit || ""}</small></span></button>)}{filtered.length === 0 && <div className="empty-state">کالایی پیدا نشد.</div>}</div></section>
      <form className="cart-panel" onSubmit={submit}><div className="section-heading"><div><h2>اقلام فاکتور</h2><p>{fa(cart.length)} قلم</p></div></div>{cart.length === 0 ? <div className="cart-empty">برای شروع، از فهرست کالا یک مورد انتخاب کنید.</div> : <div className="cart-lines">{cart.map((line) => <div className="cart-line" key={line.product.variant_id}><div><strong>{line.product.product_name || "—"}</strong><small>{money(line.product.sale_price ?? 0)} · {line.product.variant_label || "—"} {line.product.sale_unit || ""}</small></div><div className="quantity-controls"><button type="button" onClick={() => qty(line.product.variant_id, -1)}>−</button><span>{fa(line.quantity)}</span><button type="button" onClick={() => qty(line.product.variant_id, 1)}>＋</button></div><strong>{money((line.product.sale_price ?? 0) * line.quantity)}</strong></div>)}</div>}
        <label className="form-label">تخفیف فاکتور (تومان)<input type="number" min="0" max={subtotal} value={discount} onChange={(e) => setDiscount(e.target.value)} /></label><label className="form-label">مشتری<select value={customerId} onChange={(e) => { setCustomerId(e.target.value); setPaid(""); }}><option value="">فروش بدون حساب مشتری</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` — ${c.phone}` : ""}{c.balance > 0 ? ` (بدهی: ${fa(c.balance)})` : ""}</option>)}</select></label>{customerId && <label className="form-label">مبلغ پرداخت‌شده (تومان)<input type="number" min="0" max={total} value={paid === "" ? String(total) : paid} onChange={(e) => setPaid(e.target.value)} /></label>}<div className="totals"><div><span>جمع جزء</span><strong>{money(subtotal)}</strong></div><div><span>تخفیف</span><strong>{money(Number(discount || 0))}</strong></div><div className="grand-total"><span>مبلغ قابل پرداخت</span><strong>{money(total)}</strong></div>{customerId && <div><span>مانده بدهی این فاکتور</span><strong>{money(Math.max(0, total - Number(paid === "" ? total : paid || 0)))}</strong></div>}</div>{error && <div className="notice error-notice">{error}</div>}<button className="primary-button full-button" disabled={busy || cart.length === 0}>{busy ? "در حال ثبت…" : "ثبت و صدور فاکتور"}</button>
      </form></div>
    </section>
    {addOpen && <div className="modal-backdrop"><form className="modal-card" onSubmit={createProduct}><button type="button" className="modal-close" onClick={() => setAddOpen(false)}>×</button><h2>افزودن کالای جدید</h2><p className="muted">می‌توانید کالا را معرفی کنید. موجودی اولیه با صفر ثبت می‌شود و فقط مدیر می‌تواند موجودی و بهای خرید را تکمیل کند.</p><label>نام کالا<input name="name" required maxLength={150}/></label><div className="form-grid"><label>مشخصات واریانت (اختیاری)<input name="variantLabel" maxLength={80}/></label><label>واحد فروش<input name="saleUnit" defaultValue="عدد" required maxLength={50}/></label><label>قیمت فروش (تومان)<input name="salePrice" type="number" min="0" required/></label></div>{error && <div className="notice error-notice">{error}</div>}<button className="primary-button full-button">ثبت کالا</button></form></div>}
    {invoice && <div className="modal-backdrop"><div className="modal-card invoice-card" id="print-invoice"><header className="invoice-store-header"><h1>{store.storeName}</h1>{store.phone && <p>تلفن: {store.phone}</p>}{store.address && <p>{store.address}</p>}</header><h2>فاکتور فروش</h2><p>شماره فاکتور: <strong>{invoice.invoiceNumber}</strong></p>{invoice.customerName && <p>مشتری: <strong>{invoice.customerName}</strong></p>}<div className="invoice-lines">{invoice.items.map((item, i) => <div key={i}><span>{item.name}{item.unit ? ` (${item.unit})` : ""} × {item.quantity}</span><strong>{money(item.lineTotal)}</strong></div>)}</div><h3>مبلغ کل: {money(invoice.total)}</h3><p>مبلغ پرداخت‌شده: <strong>{money(invoice.paid)}</strong></p><p>مانده بدهی: <strong>{money(invoice.remaining)}</strong></p><div className="modal-actions"><button className="secondary-button" onClick={() => window.print()}>چاپ فاکتور</button><button className="primary-button" onClick={() => setInvoice(null)}>فاکتور بعدی</button></div></div></div>}
  </main>;
}
