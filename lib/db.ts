
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { products as seedProducts } from "@/data/products";

const dataDirectory = path.join(process.cwd(), "data");

fs.mkdirSync(dataDirectory, { recursive: true });

const databasePath = path.join(dataDirectory, "store.db");

const db = new Database(databasePath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'seller')),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS store_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS product_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    fabric TEXT,
    category TEXT,
    description TEXT,
    image TEXT,
    old_price INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS product_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id INTEGER NOT NULL,
    color TEXT NOT NULL,
    size TEXT NOT NULL,
    purchase_price INTEGER NOT NULL DEFAULT 0,
    sale_price INTEGER NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (model_id) REFERENCES product_models(id),
    UNIQUE (model_id, color, size)
  );

  CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier TEXT,
    total_amount INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    purchased_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS purchase_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER NOT NULL,
    variant_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
    FOREIGN KEY (purchase_id) REFERENCES purchases(id),
    FOREIGN KEY (variant_id) REFERENCES product_variants(id)
  );

  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT NOT NULL UNIQUE,
    total_amount INTEGER NOT NULL DEFAULT 0,
    discount INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    paid_amount INTEGER NOT NULL DEFAULT 0,
    sold_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    variant_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
    unit_cost INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (sale_id) REFERENCES sales(id),
    FOREIGN KEY (variant_id) REFERENCES product_variants(id)
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    amount INTEGER NOT NULL CHECK (amount >= 0),
    notes TEXT,
    spent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    amount INTEGER NOT NULL CHECK (amount > 0),
    method TEXT NOT NULL CHECK (method IN ('cash', 'card')),
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    paid_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
`);

// Keep older local databases compatible with the current schema.
const salesColumns = db.prepare("PRAGMA table_info(sales)").all() as { name: string }[];
if (!salesColumns.some((column) => column.name === "created_by")) {
  db.exec("ALTER TABLE sales ADD COLUMN created_by INTEGER REFERENCES users(id)");
}
if (!salesColumns.some((column) => column.name === "customer_id")) {
  db.exec("ALTER TABLE sales ADD COLUMN customer_id INTEGER REFERENCES customers(id)");
}
if (!salesColumns.some((column) => column.name === "paid_amount")) {
  db.exec("ALTER TABLE sales ADD COLUMN paid_amount INTEGER NOT NULL DEFAULT 0");
}

db.exec("CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id)");

// ستون‌های کاتالوگ فروشگاه برای سازگاری با دیتابیس‌های قبلی
const modelColumns = db.prepare("PRAGMA table_info(product_models)").all() as { name: string }[];
for (const [name, type] of [["category", "TEXT"], ["description", "TEXT"], ["image", "TEXT"], ["old_price", "INTEGER"]] as const) {
  if (!modelColumns.some((column) => column.name === name)) {
    db.exec(`ALTER TABLE product_models ADD COLUMN ${name} ${type}`);
  }
}

/**
 * کاتالوگ فروشگاه و پنل مدیریت از همین جدول‌ها تغذیه می‌شوند.
 * در اولین اجرا، کالاهای فعلی فروشگاه (data/products.ts) اینجا ثبت می‌شوند.
 */
function seedCatalog() {
  const existing = (db.prepare("SELECT COUNT(*) AS count FROM product_models").get() as { count: number }).count;
  if (existing > 0) return;

  // کالاهایی که در منبع اصلی «ناموجود» بودند
  const outOfStockIds = new Set([11, 21, 30, 31, 32, 45, 47, 85, 122, 123, 131, 138, 139, 140, 167, 168, 299]);
  const DEFAULT_OPENING_STOCK = 10;

  const insertModel = db.prepare(
    "INSERT INTO product_models (code, name, fabric, category, description, image, old_price) VALUES (?, ?, NULL, ?, ?, ?, ?)"
  );
  const insertVariant = db.prepare(
    "INSERT INTO product_variants (model_id, color, size, purchase_price, sale_price, stock) VALUES (?, '-', '-', 0, ?, ?)"
  );

  const seed = db.transaction(() => {
    let index = 0;
    for (const product of seedProducts) {
      index += 1;
      const modelId = Number(
        insertModel.run(
          `K-${String(index).padStart(3, "0")}`,
          product.name,
          product.category,
          product.description,
          product.image,
          product.oldPrice ?? null
        ).lastInsertRowid
      );
      insertVariant.run(
        modelId,
        product.price ?? 0,
        outOfStockIds.has(product.id) ? 0 : DEFAULT_OPENING_STOCK
      );
    }
  });
  seed.immediate();
}

seedCatalog();

export function backupDatabase(destination = path.join(os.homedir(), "ShopManagementBackups")) {
  fs.mkdirSync(destination, { recursive: true });
  const filename = `store-${new Date().toISOString().replace(/[:.]/g, "-")}.db`;
  return db.backup(path.join(destination, filename));
}

export default db;
