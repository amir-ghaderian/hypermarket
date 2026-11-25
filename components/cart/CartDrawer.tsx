"use client";

import { useState } from "react";
import Image from "next/image";
import { useCart } from "@/components/cart/CartProvider";
import { formatPrice } from "@/lib/format";

export default function CartDrawer() {
  const {
    items,
    count,
    total,
    isOpen,
    closeCart,
    increment,
    decrement,
    removeItem,
    clearCart,
  } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function checkout() {
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const lines = items
        .filter((item) => typeof item.variantId === "string")
        .map((item) => ({ variantId: item.variantId, quantity: item.quantity }));
      if (lines.length === 0) {
        throw new Error("این اقلام قابل سفارش آنلاین نیستند.");
      }
      const response = await fetch("/api/shop/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: lines }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "ثبت سفارش انجام نشد.");
      clearCart();
      setNotice(`سفارش ثبت شد. شماره فاکتور: ${data.order.invoiceNumber}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ثبت سفارش انجام نشد.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={closeCart}
        aria-hidden={!isOpen}
        className={`fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Drawer (از سمت چپ باز می‌شود) */}
      <aside
        dir="rtl"
        aria-hidden={!isOpen}
        className={`fixed inset-y-0 left-0 z-[70] flex w-full max-w-[420px] flex-col bg-white shadow-2xl transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🛒</span>
            <h2 className="text-base font-black text-gray-900">سبد خرید</h2>
            <span className="rounded-full bg-emerald-700 px-2.5 py-0.5 text-xs font-bold text-white">
              {count}
            </span>
          </div>
          <button
            type="button"
            onClick={closeCart}
            aria-label="بستن سبد خرید"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition hover:bg-gray-50"
          >
            ✕
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-gray-400">
              <span className="text-4xl">🧺</span>
              <p className="text-sm font-bold">سبد خرید شما خالی است</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex gap-3 rounded-2xl border border-gray-100 bg-gray-50/60 p-3"
                >
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-white">
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      sizes="80px"
                      className="object-contain p-1.5"
                    />
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col justify-between text-right">
                    <p className="line-clamp-2 text-[13px] font-bold leading-6 text-gray-800">
                      {item.name}
                    </p>

                    <div className="mt-2 flex items-center justify-between">
                      {/* Quantity controls */}
                      <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-1">
                        <button
                          type="button"
                          onClick={() => increment(item.id)}
                          aria-label="افزایش تعداد"
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-lg font-bold text-emerald-700 transition hover:bg-emerald-50"
                        >
                          +
                        </button>
                        <span className="min-w-6 text-center text-sm font-black text-gray-800">
                          {formatPrice(item.quantity)}
                        </span>
                        <button
                          type="button"
                          onClick={() => decrement(item.id)}
                          aria-label="کاهش تعداد"
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-lg font-bold text-emerald-700 transition hover:bg-emerald-50"
                        >
                          −
                        </button>
                      </div>

                      <div className="text-left">
                        <div className="text-[13px] font-black text-emerald-800">
                          {formatPrice(item.price * item.quantity)} تومان
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {formatPrice(item.price)} تومان × واحد
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    aria-label="حذف از سبد خرید"
                    className="h-7 shrink-0 self-start rounded-lg px-2 text-xs font-bold text-rose-500 transition hover:bg-rose-50"
                  >
                    حذف
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-gray-100 px-5 py-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-gray-500">
                تعداد کالا: {formatPrice(count)}
              </span>
              <span className="font-bold text-gray-500">مبلغ نهایی</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-lg font-black text-emerald-800">
                {formatPrice(total)} تومان
              </span>
            </div>
            {notice && (
              <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-700">
                {notice}
              </p>
            )}
            {error && (
              <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-600">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={() => void checkout()}
              disabled={submitting}
              className="mt-4 w-full rounded-2xl bg-emerald-700 py-3 text-sm font-black text-white transition hover:bg-emerald-800 disabled:opacity-60"
            >
              {submitting ? "در حال ثبت…" : "تکمیل خرید"}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
