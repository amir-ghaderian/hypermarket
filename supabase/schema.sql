-- ============================================================================
-- Hypermarket — central schema (Supabase / PostgreSQL)
-- Run ONCE in: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: everything uses IF NOT EXISTS / CREATE OR REPLACE only.
-- No DROP / DELETE / TRUNCATE anywhere.
--
-- Mirrors the current SQLite data/store.db 1:1 so the storefront and the admin
-- panel read & write the SAME central data (products, prices, stock, sales).
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- auth/users
create table if not exists users (
  id            bigint generated always as identity primary key,
  username      text unique not null,
  display_name  text not null,
  password_hash text not null,
  role          text not null check (role in ('admin','seller')),
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists sessions (
  id         text primary key,
  user_id    bigint not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists store_settings (
  setting_key   text primary key,
  setting_value text not null default ''
);

-- --------------------------------------------------------------- catalog
create table if not exists product_models (
  id          bigint generated always as identity primary key,
  code        text unique not null,
  name        text not null,
  fabric      text,
  category    text,
  description text,
  image       text,
  old_price   bigint,
  created_at  timestamptz not null default now()
);

create table if not exists product_variants (
  id             bigint generated always as identity primary key,
  model_id       bigint not null references product_models(id) on delete cascade,
  color          text not null default '-',
  size           text not null default '-',
  purchase_price bigint  not null default 0 check (purchase_price >= 0),
  sale_price     bigint  not null default 0 check (sale_price >= 0),
  stock          integer not null default 0 check (stock >= 0),
  created_at     timestamptz not null default now(),
  unique (model_id, color, size)
);
create index if not exists idx_variants_model on product_variants(model_id);

-- ----------------------------------------------------- inventory ledger
-- Every stock change (opening balance, sale, manual, purchase) is recorded here.
create table if not exists inventory_movements (
  id         bigint generated always as identity primary key,
  variant_id bigint not null references product_variants(id) on delete cascade,
  quantity   integer not null,                -- + increase / - decrease
  reason     text not null,                   -- 'opening' | 'sale' | 'manual' | 'purchase'
  doc_number text,                            -- opening document number
  reference  text,                            -- e.g. invoice number
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists idx_movements_variant on inventory_movements(variant_id);
-- "Opening balance recorded AT MOST ONCE per variant" as a DB guarantee:
create unique index if not exists ux_opening_per_variant
  on inventory_movements(variant_id) where reason = 'opening';

-- --------------------------------------------------- atomic stock change
-- Shared by in-store AND online sales. Guarded UPDATE => no oversell.
-- Raises and rolls back the transaction when stock would go negative.
create or replace function apply_stock_change(
  p_variant_id bigint,
  p_delta      integer,          -- negative to decrease
  p_reason     text,
  p_reference  text default null,
  p_note       text default null
) returns integer
language plpgsql as $$
declare
  new_stock integer;
begin
  update product_variants
     set stock = stock + p_delta
   where id = p_variant_id
     and stock + p_delta >= 0
  returning stock into new_stock;

  if new_stock is null then
    raise exception 'INSUFFICIENT_STOCK: variant %', p_variant_id;
  end if;

  insert into inventory_movements (variant_id, quantity, reason, reference, note)
  values (p_variant_id, p_delta, p_reason, p_reference, p_note);

  return new_stock;
end;
$$;

-- --------------------------------------------------------------- customers
create table if not exists customers (
  id         bigint generated always as identity primary key,
  name       text not null,
  phone      text,
  notes      text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------- sales
create table if not exists sales (
  id             bigint generated always as identity primary key,
  invoice_number text unique not null,
  total_amount   bigint not null default 0,
  discount       bigint not null default 0,
  notes          text,
  created_by     bigint references users(id),
  customer_id    bigint references customers(id) on delete set null,
  paid_amount    bigint not null default 0,
  channel        text not null default 'in_store' check (channel in ('in_store','online')),
  sold_at        timestamptz not null default now()
);

create table if not exists sale_items (
  id         bigint generated always as identity primary key,
  sale_id    bigint not null references sales(id) on delete cascade,
  variant_id bigint not null references product_variants(id),
  quantity   integer not null check (quantity > 0),
  unit_price bigint  not null check (unit_price >= 0),
  unit_cost  bigint  not null default 0
);
create index if not exists idx_sale_items_sale on sale_items(sale_id);

-- -------------------------------------------------------------- purchases
create table if not exists purchases (
  id           bigint generated always as identity primary key,
  supplier     text,
  total_amount bigint not null default 0,
  notes        text,
  purchased_at timestamptz not null default now()
);

create table if not exists purchase_items (
  id          bigint generated always as identity primary key,
  purchase_id bigint not null references purchases(id) on delete cascade,
  variant_id  bigint not null references product_variants(id),
  quantity    integer not null check (quantity > 0),
  unit_price  bigint  not null check (unit_price >= 0)
);

-- ----------------------------------------------------------- expenses/payments
create table if not exists expenses (
  id       bigint generated always as identity primary key,
  title    text not null,
  amount   bigint not null check (amount >= 0),
  notes    text,
  spent_at timestamptz not null default now()
);

create table if not exists payments (
  id          bigint generated always as identity primary key,
  customer_id bigint not null references customers(id) on delete cascade,
  amount      bigint not null check (amount > 0),
  method      text not null check (method in ('cash','card')),
  notes       text,
  created_by  bigint references users(id),
  paid_at     timestamptz not null default now()
);
create index if not exists idx_payments_customer on payments(customer_id);

-- --------------------------------------------------------------- RLS
-- Server routes use the SECRET key (bypasses RLS). The public key may only READ
-- the catalog; all writes stay server-side.
alter table product_models      enable row level security;
alter table product_variants    enable row level security;
alter table inventory_movements enable row level security;

drop policy if exists read_catalog  on product_models;
create policy read_catalog on product_models for select using (true);

drop policy if exists read_variants on product_variants;
create policy read_variants on product_variants for select using (true);
-- stock/price WRITES stay server-side (secret key) only.

-- ============================================================================
-- DONE — schema only. No product/inventory data is inserted by this file.
-- The 282 products + opening stock are loaded by a SEPARATE migration that is
-- pending your review of supabase/inventory-match-report.csv.
-- ============================================================================
