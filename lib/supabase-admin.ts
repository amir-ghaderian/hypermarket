import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * کلاینت Supabase فقط برای سمت سرور (کلید سکرت / service_role).
 *
 * امنیت:
 *  - ایمپورت `server-only` باعث می‌شود اگر روزی این ماژول از یک Client Component
 *    ایمپورت شود، بیلد با خطا متوقف شود.
 *  - کلید محرمانه (SUPABASE_SECRET_KEY) پیشوند NEXT_PUBLIC_ ندارد، پس هرگز به
 *    مرورگر فرستاده نمی‌شود.
 *  - این ماژول را صرفاً از Route Handlerها / کد سرور استفاده کن.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

export function supabaseAdmin(): SupabaseClient {
  if (!url || !secretKey) {
    throw new Error(
      "کلیدهای سروری Supabase موجود نیست (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY).",
    );
  }

  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
