import { NextResponse } from "next/server";
import { userCount } from "@/lib/auth";
import { getStoreProfile, saveStoreProfile, storeSetupComplete } from "@/lib/store";
import { currentUser } from "@/lib/auth";

export async function GET() {
  const store = getStoreProfile();
  const user = await currentUser();
  return NextResponse.json({ success: true, store, setupRequired: !store.storeName, adminRequired: (await userCount()) === 0, user: user ? { role: user.role } : null });
}

export async function POST(request: Request) {
  const user = await currentUser();
  const allowEdit = user?.role === "admin";
  if ((await userCount()) > 0 || storeSetupComplete()) {
    if (!allowEdit) {
      return NextResponse.json({ message: user ? "فقط مدیر می‌تواند مشخصات فروشگاه را تغییر دهد." : "برای تغییر مشخصات فروشگاه با حساب مدیر وارد شوید." }, { status: user ? 403 : 401 });
    }
  }
  try {
    const body = await request.json();
    const profile = {
      storeType: String(body.storeType ?? "").trim().slice(0, 80),
      products: String(body.products ?? "").trim().slice(0, 200),
      storeName: String(body.storeName ?? "").trim().slice(0, 120),
      phone: String(body.phone ?? "").trim().slice(0, 40),
      address: String(body.address ?? "").trim().slice(0, 250),
    };
    if (profile.storeType.length < 2 || profile.products.length < 2 || profile.storeName.length < 2) {
      return NextResponse.json({ message: "نوع فروشگاه، کالاهای اصلی و نام فروشگاه را کامل کنید." }, { status: 400 });
    }
    if (profile.phone && !/^[+()0-9\u0660-\u0669\u06F0-\u06F9\s-]{7,40}$/.test(profile.phone)) {
      return NextResponse.json({ message: "شماره تماس را بررسی کنید یا خالی بگذارید." }, { status: 400 });
    }
    try {
      await saveStoreProfile(profile, allowEdit);
    } catch (error) {
      if (error instanceof Error && error.message.includes("قبلاً")) return NextResponse.json({ message: error.message }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Store setup failed", error);
    return NextResponse.json({ message: "ثبت اطلاعات فروشگاه انجام نشد." }, { status: 500 });
  }
}
