import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

const COOKIE = "store_session";
const SESSION_DAYS = 7;

export type User = { id: number; username: string; display_name: string; role: "admin" | "seller" };

/**
 * ورود بدون رمز فقط برای توسعهٔ محلی روی localhost.
 * در production (Vercel و next start) هرگز فعال نمی‌شود و احراز هویت کامل اجباری است.
 * برای خاموش‌کردن دستی این حالت، متغیر محیطی ALLOW_LOCAL_ADMIN=0 را ست کنید.
 */
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|::1)(:\d+)?$/i;

async function localDevUser(): Promise<User | null> {
  if (process.env.NODE_ENV === "production") return null;
  if (process.env.ALLOW_LOCAL_ADMIN === "0") return null;
  const host = (await headers()).get("host") ?? "";
  if (!LOCAL_HOST.test(host)) return null;

  // اگر کاربری در Supabase وجود دارد از همان استفاده می‌شود تا ارجاع‌های sales.created_by معتبر بمانند.
  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from("users")
    .select("id, username, display_name")
    .eq("active", true)
    .order("role", { ascending: true }) // 'admin' پیش از 'seller' می‌آید
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  return {
    id: Number(data?.id ?? 0),
    username: data?.username ?? "local-admin",
    display_name: data?.display_name ?? "مدیر محلی",
    role: "admin",
  };
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${key}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(key, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

/** کاربر جاری از Supabase (sessions + users). */
export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return localDevUser();

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from("sessions")
    .select("expires_at, users!inner(id, username, display_name, role, active)")
    .eq("id", tokenHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  type EmbeddedUser = {
    id: number;
    username: string;
    display_name: string;
    role: "admin" | "seller";
    active: boolean;
  };
  const account = (data as { users?: EmbeddedUser } | null)?.users;
  if (account && account.active) {
    return { id: account.id, username: account.username, display_name: account.display_name, role: account.role };
  }
  return localDevUser();
}

/** ساخت نشست در Supabase و برگرداندن توکن خام (فقط در کوکی نگهداری می‌شود). */
export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("sessions")
    .insert({ id: tokenHash, user_id: userId, expires_at: expiresAt });
  if (error) throw error;

  return token;
}

export async function setSessionCookie(token: string) {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const supabase = supabaseAdmin();
    await supabase.from("sessions").delete().eq("id", tokenHash);
  }
  jar.delete(COOKIE);
}

/** تعداد کاربران (برای تشخیص نیاز به راه‌اندازی اولیه). */
export async function userCount(): Promise<number> {
  const supabase = supabaseAdmin();
  const { count, error } = await supabase.from("users").select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}
