"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { Product } from "@/types/product";
import { discountPercent, formatPrice, isDiscounted } from "@/lib/format";
import ProductDrawer from "@/components/products/ProductDrawer";

const MAX_PER_CATEGORY = 5;

/** عرض هر کارت (px) و فاصله افقی دو طرف آن (mx-2 => 8px هر طرف) */
const CARD_WIDTH = 220;
const CARD_GAP = 16;
/** سرعت حرکت یکنواخت بر حسب پیکسل بر ثانیه */
const SPEED_PX_PER_SEC = 90;

type DealTimelineProps = {
  products: Product[];
};

/** انتخاب پرفروش‌ترین حراجی‌ها: از هر دسته، بیشترین درصد تخفیف (اولویت دوم: قیمت نهایی کمتر) */
function pickDeals(products: Product[]): Product[] {
  const discounted = products.filter(isDiscounted);
  const byCategory = new Map<string, Product[]>();

  for (const product of discounted) {
    const list = byCategory.get(product.category) ?? [];
    list.push(product);
    byCategory.set(product.category, list);
  }

  const selected: Product[] = [];
  for (const list of byCategory.values()) {
    const sorted = [...list].sort((a, b) => {
      const pa = discountPercent(a.price as number, a.oldPrice as number);
      const pb = discountPercent(b.price as number, b.oldPrice as number);
      if (pb !== pa) return pb - pa; // تخفیف بیشتر
      return (a.price as number) - (b.price as number); // قیمت نهایی کمتر
    });
    selected.push(...sorted.slice(0, MAX_PER_CATEGORY));
  }

  return selected.sort((a, b) => {
    const pa = discountPercent(a.price as number, a.oldPrice as number);
    const pb = discountPercent(b.price as number, b.oldPrice as number);
    if (pb !== pa) return pb - pa;
    return (a.price as number) - (b.price as number);
  });
}

export default function DealTimeline({ products }: DealTimelineProps) {
  const deals = useMemo(() => pickDeals(products), [products]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // اندازه‌گیری عرض ظرف (بدون setState داخل effect) تا تعداد تکرار متناسب شود
  const roRef = useRef<ResizeObserver | null>(null);
  const measureRef = useCallback((node: HTMLDivElement | null) => {
    roRef.current?.disconnect();
    if (!node) return;
    setContainerWidth(node.clientWidth);
    const ro = new ResizeObserver(() => setContainerWidth(node.clientWidth));
    ro.observe(node);
    roRef.current = ro;
  }, []);

  // یک مجموعه = همه کارت‌های حراج؛ هر نیمه باید حداقل به اندازه عرض ظرف باشد
  const setWidth = Math.max(1, deals.length * (CARD_WIDTH + CARD_GAP));
  const copies = Math.max(1, Math.ceil(containerWidth / setWidth) + 1);
  const halfWidth = copies * setWidth;
  const duration = Math.max(15, Math.round(halfWidth / SPEED_PX_PER_SEC));

  if (deals.length === 0) return null;

  const renderCard = (product: Product, key: string) => {
    const price = product.price as number;
    const oldPrice = product.oldPrice as number;
    const percent = discountPercent(price, oldPrice);
    return (
      <button
        key={key}
        type="button"
        dir="rtl"
        onClick={() => setSelected(product)}
        className="group mx-2 flex w-[220px] shrink-0 flex-col items-stretch overflow-hidden rounded-2xl border-2 border-rose-500 bg-white text-right shadow-[0_8px_26px_rgba(225,29,72,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(225,29,72,0.28)]"
      >
        <div className="relative flex h-[150px] items-center justify-center bg-rose-50/60">
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="220px"
            className="object-contain p-4"
          />
          <span className="absolute right-2 top-2 rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-black text-white shadow">
            {formatPrice(percent)}٪
          </span>
        </div>
        <div className="flex flex-1 flex-col p-3">
          <p className="line-clamp-2 min-h-[44px] text-[12px] font-black leading-6 text-gray-800">
            {product.name}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[13px] font-black text-rose-600">
              {formatPrice(price)} تومان
            </span>
            <span className="text-[14px] font-bold text-gray-400 line-through">
              {formatPrice(oldPrice)}
            </span>
          </div>
        </div>
      </button>
    );
  };

  // یک نیمه شامل «copies» تکرار از مجموعه کارت‌ها
  const renderHalf = (half: "a" | "b") => (
    <div className="flex" aria-hidden={half === "b" ? true : undefined}>
      {Array.from({ length: copies }).map((_, copyIndex) =>
        deals.map((product, index) =>
          renderCard(product, `${half}-${copyIndex}-${index}-${product.id}`)
        )
      )}
    </div>
  );

  return (
    <section
      id="deals"
      className="mx-auto max-w-7xl px-5 py-12 sm:px-6"
    >
      <div className="overflow-hidden rounded-[32px] border-2 border-rose-500 bg-gradient-to-l from-rose-50 via-white to-rose-50 shadow-[0_10px_40px_rgba(225,29,72,0.08)]">
        {/* Title */}
        <div className="flex items-center gap-3 border-b-2 border-rose-100 px-5 py-4 sm:px-7">
          <span className="text-2xl">🔥</span>
          <div className="text-right">
            <h2 className="text-xl font-black text-rose-600 sm:text-2xl">
              حراج شگفت‌انگیز
            </h2>
            <p className="text-[11px] text-gray-500">
              بیشترین تخفیف‌ها از هر دسته‌بندی
            </p>
          </div>
        </div>

        {/* Marquee */}
        <div ref={measureRef} className="deal-marquee overflow-hidden py-5" dir="ltr">
          <div
            className="deal-track flex w-max"
            style={{ animationDuration: `${duration}s` }}
          >
            {renderHalf("a")}
            {renderHalf("b")}
          </div>
        </div>
      </div>

      <ProductDrawer product={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
