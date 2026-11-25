"use client";

import Image from "next/image";
import { useState } from "react";
import type { Product } from "@/types/product";
import { useCart } from "@/components/cart/CartProvider";
import { discountPercent, formatPrice, isDiscounted } from "@/lib/format";

type ProductDrawerProps = {
  product: Product | null;
  onClose: () => void;
};

export default function ProductDrawer({ product, onClose }: ProductDrawerProps) {
  const open = product !== null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden={!open}
        className={`fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Drawer (از سمت راست باز می‌شود) */}
      <aside
        dir="rtl"
        aria-hidden={!open}
        className={`fixed inset-y-0 right-0 z-[90] flex w-full max-w-[460px] flex-col bg-white shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {product && (
          <DrawerBody key={product.id} product={product} onClose={onClose} />
        )}
      </aside>
    </>
  );
}

function DrawerBody({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const { addItem } = useCart();
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");

  // تصاویر موجود محصول (ساختار فعلی Hyper: یک تصویر برای هر محصول)
  const images = [product.image];
  const labels = ["نمای اصلی"];

  const discounted = isDiscounted(product);
  const percent = discounted
    ? discountPercent(product.price as number, product.oldPrice as number)
    : 0;

  const handleMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setOrigin(`${x}% ${y}%`);
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
          {product.category}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="بستن جزئیات محصول"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition hover:bg-gray-50"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {/* Gallery */}
        <div className="relative">
          <div
            onMouseEnter={() => setZoom(true)}
            onMouseLeave={() => setZoom(false)}
            onMouseMove={handleMove}
            className="relative h-[300px] w-full cursor-zoom-in overflow-hidden rounded-2xl border border-gray-100 bg-[#f7faf6]"
          >
            <Image
              key={images[activeIndex]}
              src={images[activeIndex]}
              alt={product.name}
              fill
              sizes="420px"
              className="object-contain p-6 transition-transform duration-200"
              style={{
                transformOrigin: origin,
                transform: zoom ? "scale(2)" : "scale(1)",
              }}
              priority
            />

            {discounted && (
              <span className="absolute right-3 top-3 rounded-full bg-rose-600 px-3 py-1 text-xs font-black text-white shadow">
                {formatPrice(percent)}٪ تخفیف
              </span>
            )}
          </div>

          {/* Thumbnails / categories */}
          <div className="mt-3 flex flex-wrap gap-2">
            {images.map((image, index) => (
              <button
                key={image}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={labels[index] ?? `تصویر ${index + 1}`}
                className={`flex flex-col items-center gap-1 rounded-xl border p-1.5 transition ${
                  activeIndex === index
                    ? "border-emerald-600 ring-2 ring-emerald-100"
                    : "border-gray-200 hover:border-emerald-300"
                }`}
              >
                <span className="relative block h-14 w-14 overflow-hidden rounded-lg bg-white">
                  <Image
                    src={image}
                    alt={labels[index] ?? `تصویر ${index + 1}`}
                    fill
                    sizes="56px"
                    className="object-contain"
                  />
                </span>
                <span className="text-[10px] font-bold text-gray-500">
                  {labels[index] ?? `تصویر ${index + 1}`}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-gray-400">
            برای بزرگ‌نمایی، نشانگر را روی تصویر نگه دارید.
          </p>
        </div>

        {/* Name */}
        <h2 className="mt-5 text-lg font-black leading-8 text-emerald-950">
          {product.name}
        </h2>

        {/* Prices */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {typeof product.price === "number" ? (
            <>
              <span className="text-xl font-black text-emerald-800">
                {formatPrice(product.price)} تومان
              </span>
              {discounted && (
                <span className="text-sm font-bold text-gray-400 line-through">
                  {formatPrice(product.oldPrice as number)} تومان
                </span>
              )}
            </>
          ) : (
            <span className="text-sm font-bold text-gray-500">
              قیمت: تماس بگیرید
            </span>
          )}
        </div>

        {/* Description */}
        <div className="mt-5">
          <h3 className="mb-2 text-sm font-black text-gray-700">
            توضیحات محصول
          </h3>
          <p className="text-[13px] leading-7 text-gray-600">
            {product.description}
          </p>
        </div>
      </div>

      {/* Footer action */}
      <div className="border-t border-gray-100 px-5 py-4">
        <button
          type="button"
          disabled={typeof product.price !== "number"}
          onClick={() => addItem(product)}
          className="w-full rounded-2xl bg-emerald-700 py-3.5 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {typeof product.price === "number"
            ? "افزودن به سبد خرید"
            : "این محصول قابل سفارش نیست"}
        </button>
      </div>
    </>
  );
}
