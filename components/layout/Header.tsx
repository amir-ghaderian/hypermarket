
"use client";

import { useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { formatPrice } from "@/lib/format";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { count, openCart } = useCart();

  return (
    <header className="sticky top-0 z-50 border-b border-emerald-100/80 bg-[#fffdf8]/95 backdrop-blur-xl">
      <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-6">

        {/* Logo */}
        <a
          href="/"
          className="group flex items-center gap-3"
          aria-label="صفحه اصلی"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-700 text-xl shadow-sm transition group-hover:scale-105">
            🛒
          </div>

          <div className="hidden text-right sm:block">
            <div className="text-lg font-black tracking-tight text-emerald-950">
              هایپرمارکت
            </div>

            <div className="text-[11px] font-medium text-emerald-700/60">
              خرید آسان، انتخاب مطمئن
            </div>
          </div>
        </a>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-9 md:flex">
          <a
            href="/"
            className="relative text-sm font-bold text-emerald-900"
          >
            خانه
            <span className="absolute -bottom-2 right-0 h-0.5 w-5 rounded-full bg-emerald-600" />
          </a>

          <a
            href="#deals"
            className="text-sm font-medium text-gray-500 transition hover:text-emerald-700"
          >
            حراج شگفت‌انگیز
          </a>

          <a
            href="#products"
            className="text-sm font-medium text-gray-500 transition hover:text-emerald-700"
          >
            محصولات
          </a>

          <a
            href="#about"
            className="text-sm font-medium text-gray-500 transition hover:text-emerald-700"
          >
            درباره ما
          </a>

          <a
            href="#contact"
            className="text-sm font-medium text-gray-500 transition hover:text-emerald-700"
          >
            تماس با ما
          </a>
        </nav>

        {/* Cart + Contact */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={openCart}
            aria-label="باز کردن سبد خرید"
            className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-100 bg-white text-xl text-emerald-900 shadow-sm transition hover:bg-emerald-50"
          >
            🛒
            {count > 0 && (
              <span className="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white">
                {formatPrice(count)}
              </span>
            )}
          </button>

          <a
            href="#contact"
            className="hidden rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800 hover:shadow-md md:block"
          >
            تماس با ما
          </a>

          {/* Mobile menu toggle */}
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-100 bg-white text-lg text-emerald-900 shadow-sm md:hidden"
            aria-label="باز کردن منو"
            aria-expanded={menuOpen}
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {menuOpen && (
        <div className="border-t border-emerald-100 bg-[#fffdf8] px-5 py-4 md:hidden">
          <nav className="flex flex-col gap-1 text-right">

            <a
              href="/"
              onClick={() => setMenuOpen(false)}
              className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"
            >
              خانه
            </a>

            <a
              href="#deals"
              onClick={() => setMenuOpen(false)}
              className="rounded-xl px-4 py-3 text-sm font-medium text-gray-600 transition hover:bg-emerald-50 hover:text-emerald-800"
            >
              حراج شگفت‌انگیز
            </a>

            <a
              href="#products"
              onClick={() => setMenuOpen(false)}
              className="rounded-xl px-4 py-3 text-sm font-medium text-gray-600 transition hover:bg-emerald-50 hover:text-emerald-800"
            >
              محصولات
            </a>

            <a
              href="#about"
              onClick={() => setMenuOpen(false)}
              className="rounded-xl px-4 py-3 text-sm font-medium text-gray-600 transition hover:bg-emerald-50 hover:text-emerald-800"
            >
              درباره ما
            </a>

            <a
              href="#contact"
              onClick={() => setMenuOpen(false)}
              className="rounded-xl px-4 py-3 text-sm font-medium text-gray-600 transition hover:bg-emerald-50 hover:text-emerald-800"
            >
              تماس با ما
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
