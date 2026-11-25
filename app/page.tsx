import Header from "@/components/layout/Header";
import Hero from "@/components/home/Hero";
import ProductCatalog from "@/components/products/ProductCatalog";
import DealTimeline from "@/components/products/DealTimeline";
import { getStoreProducts } from "@/lib/catalog";

// کاتالوگ فروشگاه از دیتابیس مشترک با پنل مدیریت خوانده می‌شود؛ پس همیشه تازه است.
export const dynamic = "force-dynamic";

export default async function Home() {
  const products = await getStoreProducts();

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-gray-50 text-gray-900"
    >
      {/* ================= HEADER ================= */}
      <Header />

      {/* ================= HERO ================= */}
      <Hero />

      {/* ================= DEALS ================= */}
      <DealTimeline products={products} />

      {/* ================= PRODUCTS ================= */}
      <section
        id="products"
        className="mx-auto max-w-7xl px-5 py-16 sm:px-6 md:py-20"
      >
        <div className="mb-12 text-right">
          <span className="text-sm font-bold text-gray-400">
            محصولات فروشگاه
          </span>

          <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            محصولات ما
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-500 sm:text-base">
            محصولات مورد نیاز روزمره را در دسته‌بندی‌های مختلف مشاهده و انتخاب
            کنید. برای مشاهده جزئیات، روی هر محصول کلیک کنید.
          </p>
        </div>

        {/* ================= CATEGORY SECTIONS ================= */}
        <ProductCatalog products={products} />
      </section>

      {/* ================= ABOUT ================= */}
      <section
        id="about"
        className="border-y border-gray-200 bg-white"
      >
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 md:py-20">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div className="text-right">
              <span className="text-sm font-bold text-gray-400">
                درباره ما
              </span>

              <h2 className="mt-3 text-3xl font-black sm:text-4xl">
                انتخاب مطمئن،
                <br />
                خرید آسان
              </h2>
            </div>

            <p className="text-right text-sm leading-8 text-gray-500 sm:text-base">
              ما تلاش می‌کنیم مجموعه‌ای از محصولات پرمصرف و مورد نیاز
              فروشگاه‌ها و خانواده‌ها را در یک مجموعه منظم در اختیار
              شما قرار دهیم؛ با تمرکز بر کیفیت، تنوع و تأمین مطمئن.
            </p>
          </div>
        </div>
      </section>

      {/* ================= CONTACT ================= */}
      <section
        id="contact"
        className="bg-gray-950"
      >
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 md:py-20">
          <div className="flex flex-col gap-8 text-right md:flex-row md:items-center md:justify-between">
            <div>
              <span className="text-sm font-medium text-gray-500">
                ارتباط با ما
              </span>

              <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">
                برای همکاری
                <br />
                با ما در تماس باشید
              </h2>
            </div>

            <a
              href="tel:+980****0000"
              className="inline-flex w-fit rounded-2xl bg-white px-7 py-4 text-sm font-black text-gray-950 transition hover:bg-gray-200"
            >
              تماس با ما
            </a>
          </div>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-center text-sm text-gray-400 sm:flex-row sm:items-center sm:justify-between sm:text-right">
          <p>
            © {new Date().getFullYear()} هایپرمارکت — تمامی حقوق محفوظ است.
          </p>

          <p>خرید آسان، انتخاب مطمئن</p>
        </div>
      </footer>
    </main>
  );
}
