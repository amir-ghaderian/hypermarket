import { NextResponse } from "next/server";
import { clearSession, createSession, currentUser, hashPassword, setSessionCookie, userCount, verifyPassword } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const user = await currentUser();
  return NextResponse.json({ setupRequired: (await userCount()) === 0, user });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mode = String(body.mode ?? "login");
    const username = String(body.username ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const supabase = supabaseAdmin();

    if (mode === "setup") {
      const displayName = String(body.displayName ?? "مدیر").trim();
      if (!/^[a-z0-9._-]{3,32}$/.test(username) || password.length < 10 || !displayName) {
        return NextResponse.json({ message: "نام کاربری باید ۳ تا ۳۲ نویسه باشد و رمز عبور حداقل ۱۰ نویسه." }, { status: 400 });
      }
      if ((await userCount()) !== 0) {
        return NextResponse.json({ message: "راه‌اندازی قبلاً انجام شده است." }, { status: 409 });
      }
      const { data, error } = await supabase
        .from("users")
        .insert({ username, display_name: displayName, password_hash: hashPassword(password), role: "admin" })
        .select("id")
        .single();
      if (error) {
        if (error.code === "23505") return NextResponse.json({ message: "راه‌اندازی قبلاً انجام شده است." }, { status: 409 });
        throw error;
      }
      await setSessionCookie(await createSession(Number(data.id)));
      return NextResponse.json({ success: true });
    }

    const { data: account, error: findError } = await supabase
      .from("users")
      .select("id, password_hash")
      .eq("username", username)
      .eq("active", true)
      .maybeSingle();
    if (findError) throw findError;

    if (!account || !verifyPassword(password, account.password_hash)) {
      return NextResponse.json({ message: "نام کاربری یا رمز عبور درست نیست." }, { status: 401 });
    }
    await setSessionCookie(await createSession(Number(account.id)));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Authentication failed", error);
    return NextResponse.json({ message: "ورود انجام نشد." }, { status: 500 });
  }
}

export async function DELETE() {
  await clearSession();
  return NextResponse.json({ success: true });
}
