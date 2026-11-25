"use client";

import { useState } from "react";
import type { Product } from "@/types/product";
import ProductCard from "@/components/products/ProductCard";
import ProductDrawer from "@/components/products/ProductDrawer";

const categories = [
  {
    id: "بهداشتی",
    title: "محصولات بهداشتی",
    description: "محصولات بهداشتی و مراقبت شخصی",
  },
  {
    id: "شوینده",
    title: "شوینده‌ها",
    description: "انواع شوینده و محصولات نظافتی",
  },
  {
    id: "نوشیدنی",
    title: "نوشیدنی‌ها",
    description: "انواع نوشیدنی و آب آشامیدنی",
  },
  {
    id: "مواد غذایی",
    title: "مواد غذایی",
    description: "انواع مواد غذایی و خوراکی",
  },
] as const;

type ProductCatalogProps = {
  products: Product[];
};

export default function ProductCatalog({ products }: ProductCatalogProps) {
  const [selected, setSelected] = useState<Product | null>(null);

  return (
    <>
      <div className="space-y-10">
        {categories.map((category) => {
          const categoryProducts = products.filter(
            (product) => product.category === category.id
          );

          if (categoryProducts.length === 0) return null;

          return (
            <section
              key={category.id}
              className="overflow-hidden rounded-[32px] border border-emerald-100/70 bg-white p-5 shadow-[0_10px_40px_rgba(16,70,45,0.05)] sm:p-7"
            >
              {/* Category Header */}
              <div className="mb-6 flex flex-col gap-3 text-right sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-2xl font-black text-emerald-950">
                    {category.title}
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    {category.description}
                  </p>
                </div>

                <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                  {categoryProducts.length} محصول
                </span>
              </div>

              {/* Horizontal Scroll */}
              <div
                className="overflow-x-auto pb-4"
                style={{ scrollbarWidth: "thin" }}
              >
                <div className="flex w-max items-stretch gap-5">
                  {categoryProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onSelect={setSelected}
                    />
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <ProductDrawer product={selected} onClose={() => setSelected(null)} />
    </>
  );
}
