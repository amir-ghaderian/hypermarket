
export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#f3f8f1]">

      {/* Background decoration */}
      <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-emerald-200/30 blur-3xl" />
      <div className="absolute -bottom-40 right-0 h-96 w-96 rounded-full bg-lime-200/30 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-5 py-16 sm:px-6 md:py-24">

        <div className="grid items-center gap-12 md:grid-cols-2">

          {/* Text */}
          <div className="text-right">

            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-4 py-2 text-xs font-bold text-emerald-800 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              محصولات مصرفی و روزمره
            </div>

            <h1 className="text-4xl font-black leading-[1.35] tracking-tight text-emerald-950 sm:text-5xl md:text-6xl">
              همه چیز برای
              <br />
              <span className="text-emerald-600">
                خریدی بهتر
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-sm leading-8 text-gray-600 sm:text-base">
              مجموعه‌ای از محصولات شوینده، نوشیدنی، بهداشتی و خوراکی،
              با انتخابی ساده و دسترسی سریع به محصولات مورد نیاز شما.
            </p>

            {/* Buttons */}
            <div className="mt-8 flex flex-wrap justify-end gap-3">

              <a
                href="#products"
                className="rounded-xl bg-emerald-700 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-700/15 transition hover:-translate-y-0.5 hover:bg-emerald-800"
              >
                مشاهده محصولات
              </a>

              <a
                href="#contact"
                className="rounded-xl border border-emerald-200 bg-white px-6 py-3 text-sm font-bold text-emerald-800 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50"
              >
                ارتباط با ما
              </a>

            </div>

            {/* Mini features */}
            <div className="mt-10 flex flex-wrap justify-end gap-3">

              <div className="rounded-2xl border border-emerald-100 bg-white/80 px-4 py-3 text-right shadow-sm">
                <div className="text-lg">✓</div>
                <div className="mt-1 text-xs font-bold text-gray-700">
                  انتخاب متنوع
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-white/80 px-4 py-3 text-right shadow-sm">
                <div className="text-lg">✓</div>
                <div className="mt-1 text-xs font-bold text-gray-700">
                  محصولات کاربردی
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-white/80 px-4 py-3 text-right shadow-sm">
                <div className="text-lg">✓</div>
                <div className="mt-1 text-xs font-bold text-gray-700">
                  تأمین مطمئن
                </div>
              </div>

            </div>
          </div>

          {/* Visual */}
          <div className="relative hidden md:block">

            <div className="relative mx-auto aspect-square max-w-[450px]">

              {/* Main card */}
              <div className="absolute inset-6 rounded-[3rem] bg-emerald-700 shadow-2xl shadow-emerald-900/15" />

              <div className="absolute inset-10 flex items-center justify-center rounded-[2.5rem] bg-[#fffdf8]">

                <div className="text-center">

                  <div className="text-[115px] leading-none">
                    🛒
                  </div>

                  <div className="mt-5 text-sm font-black text-emerald-950">
                    خرید آسان، انتخاب مطمئن
                  </div>

                  <div className="mt-2 text-xs text-gray-400">
                    محصولات روزمره در یک مجموعه
                  </div>

                </div>
              </div>

              {/* Floating card 1 */}
              <div className="absolute -right-2 top-16 rounded-2xl border border-emerald-100 bg-white px-5 py-4 shadow-xl">
                <div className="text-[11px] font-medium text-gray-400">
                  دسته‌بندی محبوب
                </div>

                <div className="mt-1 flex items-center gap-2 text-sm font-black text-emerald-900">
                  <span>🧴</span>
                  شوینده
                </div>
              </div>

              {/* Floating card 2 */}
              <div className="absolute -bottom-2 left-2 rounded-2xl border border-emerald-100 bg-white px-5 py-4 shadow-xl">
                <div className="text-[11px] font-medium text-gray-400">
                  محصولات روزمره
                </div>

                <div className="mt-1 flex items-center gap-2 text-sm font-black text-emerald-900">
                  <span>🥤</span>
                  نوشیدنی
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

