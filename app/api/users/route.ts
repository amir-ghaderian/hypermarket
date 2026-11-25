import { NextResponse } from "next/server";
import { currentUser, hashPassword } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ message: "ابتدا وارد شوید." }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ message: "فقط مدیر اجازهٔ مدیریت کاربران را دارد." }, { status: 403 });

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .select("id, username, display_name, role, active, created_at")
    .order("id", { ascending: true });
  if (error) {
    console.error("Users fetch failed:", error);
    return NextResponse.json({ message: "دریافت کاربران ناموفق بود." }, { status: 500 });
  }
  return NextResponse.json({ success: true, users: data });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ message: "ابتدا وارد شوید." }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ message: "فقط مدیر اجازهٔ افزودن کاربر را دارد." }, { status: 403 });

  const body = await request.json();
  const username = String(body.username ?? "").trim().toLowerCase();
  const displayName = String(body.displayName ?? "").trim();
  const password = String(body.password ?? "");
  if (!USERNAME_RE.test(username) || !displayName || password.length < 10) {
    return NextResponse.json({ message: "نام کاربری معتبر، نام نمایشی و رمز حداقل ۱۰ نویسه لازم است." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase.from("users").insert({
    username,
    display_name: displayName,
    password_hash: hashPassword(password),
    role: "seller",
  });
  if (error) {
    if (error.code === "23505") return NextResponse.json({ message: "این نام کاربری قبلاً ثبت شده است." }, { status: 409 });
    console.error("User creation failed:", error);
    return NextResponse.json({ message: "ثبت کاربر انجام نشد." }, { status: 500 });
  }
  return NextResponse.json({ success: true }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ message: "ابتدا وارد شوید." }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ message: "فقط مدیر اجازهٔ ویرایش کاربر را دارد." }, { status: 403 });

  const body = await request.json();
  const id = Number(body.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.json({ message: "شناسهٔ کاربر معتبر نیست." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.displayName !== undefined) {
    const displayName = String(body.displayName ?? "").trim();
    if (!displayName) return NextResponse.json({ message: "نام نمایشی الزامی است." }, { status: 400 });
    patch.display_name = displayName;
  }
  if (body.role !== undefined) {
    const role = String(body.role);
    if (role !== "admin" && role !== "seller") {
      return NextResponse.json({ message: "نقش معتبر نیست." }, { status: 400 });
    }
    patch.role = role;
  }
  if (body.active !== undefined) {
    patch.active = Boolean(body.active);
  }
  if (body.password !== undefined && body.password !== "") {
    const password = String(body.password);
    if (password.length < 10) {
      return NextResponse.json({ message: "رمز عبور باید حداقل ۱۰ نویسه باشد." }, { status: 400 });
    }
    patch.password_hash = hashPassword(password);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ message: "تغییری برای ذخیره وجود ندارد." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .update(patch)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("User update failed:", error);
    return NextResponse.json({ message: "ویرایش کاربر انجام نشد." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ message: "کاربر پیدا نشد." }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
