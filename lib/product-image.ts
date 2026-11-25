import "server-only";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * مدیریت مسیر تصویر محصول — فقط روی فایل‌سیستم پروژه (پوشهٔ public).
 *
 * تصمیم معماری: هیچ تصویری به Supabase Storage آپلود نمی‌شود؛ در `products.image`
 * فقط مسیر نسبی تصویر داخل پوشهٔ public ذخیره می‌گردد (مثال: /images/products/123.jpg).
 * هیچ فایلی حذف یا جابه‌جا نمی‌شود.
 */

export const PRODUCT_IMAGE_DIR = "/images/products";

/** پسوندهای مجاز تصویر. */
const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export function isAllowedImageName(name: string): boolean {
  return ALLOWED_EXT.has(path.extname(name).toLowerCase());
}

/**
 * تبدیل مسیر نسبی به مسیر مطلق داخل public با رد کردن مسیرهای ناامن
 * (مسیر مطلق سیستم مثل /Users/... ، مسیر دارای .. و هر چیز بیرون پوشهٔ public).
 */
function resolveInsidePublic(relative: string): { abs: string } | { error: string } {
  if (!relative.startsWith("/")) {
    return { error: "مسیر تصویر باید نسبی و با / شروع شود (مثال: /images/products/123.jpg)." };
  }
  if (relative.includes("..")) return { error: "مسیر تصویر معتبر نیست." };
  const publicDir = path.join(process.cwd(), "public");
  const abs = path.resolve(publicDir, "." + relative);
  if (abs !== publicDir && !abs.startsWith(publicDir + path.sep)) {
    return { error: "فقط مسیرهای داخل پوشهٔ public پروژه مجاز است." };
  }
  return { abs };
}

/**
 * تعیین مقداری که در `products.image` ذخیره می‌شود — بدون هیچ آپلود و بدون دست‌زدن به Storage.
 *  - خالی → null
 *  - مسیر نسبی داخل public که فایلش واقعاً وجود دارد → همان مسیر نسبی ذخیره می‌شود
 *  - مقدار قدیمی به‌صورت URL کامل (مثل تصویر فعلی K-001) → دست‌نخورده باقی می‌ماند
 *  - مسیر ناموجود / بیرون public / مطلق سیستم (/Users/...) → خطای واضح
 */
export async function resolveProductImage(
  value: unknown,
): Promise<{ value: string | null } | { error: string }> {
  const raw = String(value ?? "").trim();
  if (!raw) return { value: null };

  // مقادیر قدیمی ذخیره‌شده به شکل URL کامل بدون تغییر باقی می‌مانند (تصویرشان حذف نمی‌شود).
  if (/^https?:\/\//i.test(raw)) return { value: raw };

  const resolved = resolveInsidePublic(raw);
  if ("error" in resolved) return resolved;

  let stat;
  try {
    stat = await fs.stat(resolved.abs);
  } catch {
    return { error: `فایل تصویر در پوشهٔ public پروژه پیدا نشد (${raw}).` };
  }
  if (!stat.isFile()) return { error: "مسیر وارد‌شده یک فایل نیست." };
  if (!isAllowedImageName(resolved.abs)) {
    return { error: "فرمت تصویر پشتیبانی نمی‌شود (jpg/jpeg/png/webp)." };
  }
  return { value: raw };
}

/** فهرست فایل‌های تصویری موجود در یک پوشهٔ داخل public (فقط خواندن از فایل‌سیستم). */
export async function listPublicImages(dir: string): Promise<{ files: string[] } | { error: string }> {
  const resolved = resolveInsidePublic(dir);
  if ("error" in resolved) return resolved;
  let entries;
  try {
    entries = await fs.readdir(resolved.abs, { withFileTypes: true });
  } catch {
    return { error: "پوشهٔ تصاویر در پوشهٔ public پیدا نشد." };
  }
  const base = dir.replace(/\/+$/, "");
  const files = entries
    .filter((entry) => entry.isFile() && isAllowedImageName(entry.name))
    .map((entry) => `${base}/${entry.name}`)
    .sort((a, b) => a.localeCompare(b, "fa"));
  return { files };
}
