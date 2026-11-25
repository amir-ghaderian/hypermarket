"use client";

import Image from "next/image";
import type { Product } from "@/types/product";
import { discountPercent, formatPrice, isDiscounted } from "@/lib/format";

type ProductCardProps = {
  product: Product;
  onSelect?: (product: Product) => void;
};

export default function ProductCard({ product, onSelect }: ProductCardProps) {
  const discounted = isDiscounted(product);
  const percent = discounted
    ? discountPercent(product.price as number, product.oldPrice as number)
    : 0;

  return (
    <article
      onClick={() => onSelect?.(product)}
      className="group flex h-full w-[245px] shrink-0 cursor-pointer flex-col overflow-hidden rounded-[24px] border border-emerald-100/70 bg-white shadow-[0_8px_30px_rgba(16,70,45,0.06)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_18px_40px_rgba(16,70,45,0.11)] sm:w-[260px]"
    >
      {/* Product Image */}
      <div className="relative flex h-[235px] shrink-0 items-center justify-center overflow-hidden bg-[#f7faf6]">
        <Image
          src={product.image}
          alt={product.name}
          fill
          className="object-contain p-5 transition duration-500 group-hover:scale-105"
          sizes="260px"
        />

        {/* Discount badge */}
        {discounted && (
          <div className="absolute right-3 top-3 rounded-full bg-rose-600 px-3 py-1 text-[11px] font-black text-white shadow">
            {formatPrice(percent)}٪
          </div>
        )}

        {/* Category Badge */}
        <div className="absolute left-3 top-3 rounded-full border border-emerald-100 bg-white/90 px-3 py-1 text-[10px] font-bold text-emerald-700 shadow-sm backdrop-blur">
          {product.category}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-5 text-right">
        {/* Product Name */}
        <h3 className="line-clamp-2 min-h-[52px] text-[15px] font-black leading-7 text-emerald-950">
          {product.name}
        </h3>

        {/* Description */}
        {product.description && (
          <p className="mt-2 line-clamp-2 min-h-[40px] text-[11px] leading-5 text-gray-500">
            {product.description}
          </p>
        )}

        {/* Prices */}
        <div className="mt-3 flex min-h-[48px] flex-wrap items-center gap-x-2 gap-y-1">
          {typeof product.price === "number" ? (
            discounted ? (
              <>
                <span className="text-[16px] font-black text-rose-600">
                  {formatPrice(product.price)} تومان
                </span>
                <span className="text-[13px] font-bold text-gray-400 line-through">
                  {formatPrice(product.oldPrice as number)}
                </span>
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-black text-rose-600">
                  {formatPrice(percent)}٪
                </span>
              </>
            ) : (
              <span className="text-[15px] font-black text-emerald-800">
                {formatPrice(product.price)} تومان
              </span>
            )
          ) : (
            <span className="text-[11px] font-bold text-gray-500">
              تماس بگیرید
            </span>
          )}
        </div>

        {/* Button */}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSelect?.(product);
          }}
          className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-xs font-black text-white shadow-sm transition-all duration-300 hover:bg-emerald-800 hover:shadow-md"
        >
          مشاهده محصول
          <span className="text-sm transition-transform duration-300 group-hover:-translate-x-1">
            ←
          </span>
        </button>
      </div>
    </article>
  );
}
