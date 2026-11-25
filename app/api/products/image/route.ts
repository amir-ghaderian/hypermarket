import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { listPublicImages, PRODUCT_IMAGE_DIR } from "@/lib/product-image";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * فهرست تصاویر موجود در پوشهٔ public پروژه (فقط خواندن از فایل‌سیستم).
 *
 * توجه: در این مسیر هیچ آپلودی انجام نمی‌شود و هیچ درخواستی به Supabase Storage
 * ارسال یا دریافت نمی‌شود. Supabase فقط مسیر نسبی تصویر را در products.image نگه می‌دارد.
 *
 * GET /api/products/image?dir=/images/products
 *   → { success: true, dir, files: ["/images/products/001.jpeg", ...] }
 */
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ message: "ابتدا وارد شوید." }, { status: 401 });
  if (user.role !== "admin") {
    return NextResponse.json({ message: "فقط مدیر اجازهٔ دیدن فهرست تصاویر پروژه را دارد." }, { status: 403 });
  }

  const dir = new URL(request.url).searchParams.get("dir")?.trim() || PRODUCT_IMAGE_DIR;
  const result = await listPublicImages(dir);
  if ("error" in result) {
    return NextResponse.json({ success: false, message: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, dir, files: result.files });
}
