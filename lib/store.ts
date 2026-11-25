import db from "@/lib/db";
import { userCount } from "@/lib/auth";

/**
 * مشخصات فروشگاه هنوز در SQLite نگه‌داری می‌شود (خارج از دامنهٔ این مرحله).
 */
export type StoreProfile = {
  storeType: string;
  products: string;
  storeName: string;
  phone: string;
  address: string;
};

export function getStoreProfile(): StoreProfile {
  const rows = db.prepare("SELECT setting_key, setting_value FROM store_settings").all() as { setting_key: string; setting_value: string }[];
  const values = Object.fromEntries(rows.map((row) => [row.setting_key, row.setting_value]));
  return {
    storeType: values.store_type ?? "",
    products: values.products ?? "",
    storeName: values.store_name ?? "",
    phone: values.phone ?? "",
    address: values.address ?? "",
  };
}

export function storeSetupComplete() {
  return Boolean(getStoreProfile().storeName);
}

export async function saveStoreProfile(profile: StoreProfile, allowExisting = false) {
  // بررسی راه‌اندازی از روی تعداد کاربران Supabase (منبع اصلی کاربران)
  if (!allowExisting && (await userCount()) > 0) {
    throw new Error("راه‌اندازی فروشگاه قبلاً انجام شده است.");
  }
  if (!allowExisting && db.prepare("SELECT 1 FROM store_settings WHERE setting_key='store_name' AND setting_value<>''").get()) {
    throw new Error("راه‌اندازی فروشگاه قبلاً انجام شده است.");
  }

  const save = db.prepare("INSERT INTO store_settings (setting_key, setting_value) VALUES (?, ?) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value");
  const transaction = db.transaction(() => {
    save.run("store_type", profile.storeType);
    save.run("products", profile.products);
    save.run("store_name", profile.storeName);
    save.run("phone", profile.phone);
    save.run("address", profile.address);
  });
  transaction.immediate();
}
