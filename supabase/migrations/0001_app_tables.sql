-- ============================================================================
-- Hypermarket — application tables migration   (v9 FINAL, for user review)
-- ----------------------------------------------------------------------------
-- WHAT THIS DOES
--   Adds the app's operational tables to the SAME Supabase project so the
--   Next.js app can run entirely on Supabase (no SQLite).
--
-- WHAT THIS DOES *NOT* DO
--   * No DROP / DELETE / TRUNCATE / UPDATE anywhere in this file.
--   * Never rewrites existing rows. The 4 real tables
--     (products / product_variants / inventory_balances / stock_movements)
--     are only touched by ADD COLUMN IF NOT EXISTS (nullable additions) plus
--     ONE deliberate column-privilege change on product_variants (hide the
--     purchase price from the public catalog — see GRANTS). RLS policies and
--     all rows of those tables are otherwise left exactly as they are.
--   * No product / inventory / user data is inserted; the real 212-product
--     catalog and opening stock stay exactly as the company entered them.
--   * Entirely re-runnable: every statement is CREATE IF NOT EXISTS /
--     ADD COLUMN IF NOT EXISTS / CREATE OR REPLACE / idempotent GRANT.
--     Re-running cannot alter or destroy existing data.
--
-- VERIFIED AGAINST the live Supabase schema (not the stale repo schema.sql):
--   products(id uuid PK, product_code, name, category, subcategory,
--            description, created_at, updated_at)
--   product_variants(id uuid PK, product_id uuid FK->products.id, variant_code,
--            sale_unit, purchase_price_toman int8, sale_price_toman int8,
--            variant_label, source_variant_code, source_row, ...note fields)
--   inventory_balances(variant_id uuid PK & FK->product_variants.id,
--            quantity numeric, quantity_confirmed bool, updated_at)
--   stock_movements(id uuid PK, variant_id uuid FK, movement_type,
--            quantity_delta numeric, source_document, source_row, note,
--            created_at)
--
-- HOW TO RUN: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run.
-- ============================================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------ app auth
create table if not exists users (
  id            bigint generated always as identity primary key,
  username      text unique not null,
  display_name  text not null,
  password_hash text not null,                 -- scrypt "salt:key" (handled in Node)
  role          text not null check (role in ('admin','seller')),
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists sessions (
  id         text primary key,                 -- sha256(session token), 64 hex chars
  user_id    bigint not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_sessions_user on sessions(user_id);

create table if not exists store_settings (
  setting_key   text primary key,
  setting_value text not null default ''
);

-- -------------------------------------------------------------- app business
create table if not exists customers (
  id         bigint generated always as identity primary key,
  name       text not null,
  phone      text,
  notes      text,
  created_at timestamptz not null default now()
);

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
  variant_id uuid not null references product_variants(id),   -- real Supabase variant id
  quantity   integer not null check (quantity > 0),
  unit_price bigint  not null check (unit_price >= 0),
  unit_cost  bigint  not null default 0
);
create index if not exists idx_sale_items_sale on sale_items(sale_id);

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

-- Part of the app's schema history; kept so a full store/inventory system can
-- grow into them later. Not used by any current screen.
create table if not exists expenses (
  id       bigint generated always as identity primary key,
  title    text not null,
  amount   bigint not null check (amount >= 0),
  notes    text,
  spent_at timestamptz not null default now()
);
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
  variant_id  uuid not null references product_variants(id),
  quantity    integer not null check (quantity > 0),
  unit_price  bigint not null check (unit_price >= 0)
);

-- ----------------------------------------------- additive columns (nullable)
-- The storefront shows a product image and an optional "before discount"
-- price; the real products table has neither column. Both nullable +
-- IF NOT EXISTS, so existing rows are untouched. Images are filled later
-- (definitive matches only).
alter table products add column if not exists image     text;
alter table products add column if not exists old_price bigint;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- --------------------------------------------------- atomic stock adjuster
-- The single writer for stock. Keeps inventory_balances + stock_movements
-- consistent and refuses to drive a balance below zero.
--   p_delta  : signed amount (negative to decrease)
--   p_reason : 'opening' | 'sale' | 'manual' | 'purchase'  (anything else -> error)
--
-- CONCURRENCY: the balance row is created first with INSERT ... ON CONFLICT DO
-- NOTHING, so two transactions racing on a variant that has no balance row yet
-- cannot fail with a duplicate-key error. The following guarded UPDATE takes
-- the row lock, so concurrent decrements are serialised and can never oversell.
--
-- SECURITY: ordinary (invoker) function -> runs with the CALLER's rights.
-- EXECUTE is revoked from PUBLIC/anon/authenticated and granted only to
-- service_role (used by the server with the secret key). A browser holding the
-- publishable key therefore cannot call it.
create or replace function adjust_inventory(
  p_variant_id uuid,
  p_delta      numeric,
  p_reason     text,
  p_reference  text default null,
  p_note       text default null
) returns numeric
language plpgsql
set search_path = public
as $$
declare
  new_qty numeric;
begin
  if p_reason is null or p_reason not in ('opening','sale','manual','purchase') then
    raise exception 'INVALID_REASON: % (allowed: opening, sale, manual, purchase)', p_reason
      using errcode = '22023';
  end if;

  -- race-safe: guarantee a balance row exists before locking it
  insert into inventory_balances (variant_id, quantity, quantity_confirmed, updated_at)
  values (p_variant_id, 0, false, now())
  on conflict (variant_id) do nothing;

  -- lock + guarded change; no row updated => the change would go negative
  update inventory_balances
     set quantity   = coalesce(quantity, 0) + p_delta,
         updated_at = now()
   where variant_id = p_variant_id
     and coalesce(quantity, 0) + p_delta >= 0
  returning quantity into new_qty;

  if new_qty is null then
    raise exception 'INSUFFICIENT_STOCK: variant %', p_variant_id
      using errcode = '23514';
  end if;

  insert into stock_movements (id, variant_id, movement_type, quantity_delta, source_document, note)
  values (gen_random_uuid(), p_variant_id, p_reason, p_delta, p_reference, p_note);

  return new_qty;
end;
$$;

-- ------------------------------------------------- atomic point-of-sale RPC
-- One transaction for the WHOLE invoice: header + line items + stock decrease.
-- Any validation error, or any line lacking stock, aborts the function and
-- rolls the entire sale back (no partial invoice, no half-decremented stock).
--   p_items: JSON array  [{"variant_id":uuid,"quantity":int,
--                          "unit_price":bigint,"unit_cost":bigint}, ...]
--   rules: channel in ('in_store','online'); 0 <= discount <= gross;
--          0 <= paid <= total; quantity 1..100000; prices >= 0.
create or replace function record_sale(
  p_invoice_number text,
  p_channel        text,
  p_discount       bigint,
  p_notes          text,
  p_created_by     bigint,
  p_customer_id    bigint,
  p_paid_amount    bigint,
  p_items          jsonb
) returns bigint
language plpgsql
set search_path = public
as $$
declare
  it        jsonb;
  v_id      uuid;
  v_qty     integer;
  v_price   bigint;
  v_cost    bigint;
  v_gross   bigint := 0;
  v_total   bigint;
  v_paid    bigint;
  v_sale_id bigint;
begin
  if p_invoice_number is null or btrim(p_invoice_number) = '' then
    raise exception 'BAD_INVOICE' using errcode = '22023';
  end if;

  if p_channel is null or p_channel not in ('in_store','online') then
    raise exception 'BAD_CHANNEL: %', p_channel using errcode = '22023';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_SALE' using errcode = '22023';
  end if;

  -- pass 1: validate every line and sum the gross amount
  for it in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(it) <> 'object' then
      raise exception 'BAD_ITEM: each line must be an object' using errcode = '22023';
    end if;
    begin
      v_id    := (it->>'variant_id')::uuid;
      v_qty   := (it->>'quantity')::integer;
      v_price := coalesce((it->>'unit_price')::bigint, 0);
      v_cost  := coalesce((it->>'unit_cost')::bigint, 0);
    exception when others then
      raise exception 'BAD_ITEM: invalid line %', it using errcode = '22023';
    end;
    if v_id is null then
      raise exception 'BAD_ITEM: variant_id is required' using errcode = '22023';
    end if;
    if v_qty is null or v_qty < 1 or v_qty > 100000 then
      raise exception 'BAD_QTY: %', v_qty using errcode = '22023';
    end if;
    if v_price < 0 or v_cost < 0 then
      raise exception 'BAD_PRICE: %', v_price using errcode = '22023';
    end if;
    v_gross := v_gross + v_price * v_qty;
  end loop;

  if p_discount is null or p_discount < 0 or p_discount > v_gross then
    raise exception 'BAD_DISCOUNT: %', p_discount using errcode = '22023';
  end if;
  v_total := v_gross - p_discount;

  -- paid: null => fully paid; otherwise must be 0..total
  if p_paid_amount is null then
    v_paid := v_total;
  else
    v_paid := p_paid_amount;
  end if;
  if v_paid < 0 or v_paid > v_total then
    raise exception 'BAD_PAID: %', v_paid using errcode = '22023';
  end if;

  insert into sales (invoice_number, total_amount, discount, notes, created_by, customer_id, paid_amount, channel)
  values (p_invoice_number, v_total, p_discount, p_notes, p_created_by, p_customer_id, v_paid, p_channel)
  returning id into v_sale_id;

  -- pass 2: line items + atomic stock decrease (adjust_inventory raises on shortage)
  for it in select value from jsonb_array_elements(p_items) loop
    v_id    := (it->>'variant_id')::uuid;
    v_qty   := (it->>'quantity')::integer;
    v_price := coalesce((it->>'unit_price')::bigint, 0);
    v_cost  := coalesce((it->>'unit_cost')::bigint, 0);

    insert into sale_items (sale_id, variant_id, quantity, unit_price, unit_cost)
    values (v_sale_id, v_id, v_qty, v_price, v_cost);

    perform adjust_inventory(v_id, -v_qty, 'sale', p_invoice_number, null);
  end loop;

  return v_sale_id;
end;
$$;

-- ============================================================================
-- GRANTS  (explicit and tight)
-- ============================================================================
-- Functions: server-only.
revoke all on function adjust_inventory(uuid, numeric, text, text, text)
  from public, anon, authenticated;
grant execute on function adjust_inventory(uuid, numeric, text, text, text)
  to service_role;

revoke all on function record_sale(text, text, bigint, text, bigint, bigint, bigint, jsonb)
  from public, anon, authenticated;
grant execute on function record_sale(text, text, bigint, text, bigint, bigint, bigint, jsonb)
  to service_role;

-- New tables: server-only. service_role must be able to read/write them.
grant all on
  users, sessions, store_settings, customers, sales, sale_items,
  payments, expenses, purchases, purchase_items
to service_role;

-- identity sequences of the NEW tables ONLY (never grant on unrelated
-- sequences; sessions / store_settings have no identity column, so none needed).
do $$
declare
  t   text;
  seq text;
begin
  foreach t in array array[
    'users','customers','sales','sale_items',
    'payments','expenses','purchases','purchase_items'
  ] loop
    seq := pg_get_serial_sequence('public.' || t, 'id');
    if seq is not null then
      execute format('grant usage, select on sequence %s to service_role', seq);
    end if;
  end loop;
end $$;

-- product_variants: the PUBLIC catalog stays readable, but only through the
-- non-sensitive columns.
--   REVOKE (table-level) : from public, anon, authenticated
--   REVOKE (column-level): purchase_price_toman & purchase_price_note, same roles
--     (needed because REVOKE ALL ON TABLE does not clear column privileges)
--   GRANT  : SELECT on the listed columns TO anon, authenticated   (NOT to public)
-- Effect: purchase_price_toman / purchase_price_note are unreadable to anyone
-- public; sale_price_toman and the other catalog columns stay readable;
-- service_role keeps full access. No row and no RLS policy is touched.
revoke all on public.product_variants from public, anon, authenticated;
revoke select (purchase_price_toman, purchase_price_note)
  on public.product_variants
  from public, anon, authenticated;
grant select (
  id, product_id, variant_code, sale_unit, variant_label,
  source_variant_code, source_row, sale_price_toman, sale_price_note, created_at
) on public.product_variants to anon, authenticated;

-- products / inventory_balances / stock_movements: grants, policies and rows
-- are left exactly as they are. (inventory_balances & stock_movements are
-- already server-only; products stays publicly readable and holds no
-- sensitive column.)

-- ------------------------------------------------------------------- RLS
-- Every app table below has RLS ENABLED and NO policies, so anon/authenticated
-- get nothing even if they somehow held a table grant. The public API roles are
-- additionally stripped of any default grants (scoped to the NEW tables only).
alter table users          enable row level security;
alter table sessions       enable row level security;
alter table store_settings enable row level security;
alter table customers      enable row level security;
alter table sales          enable row level security;
alter table sale_items     enable row level security;
alter table payments       enable row level security;
alter table expenses       enable row level security;
alter table purchases      enable row level security;
alter table purchase_items enable row level security;

revoke all on
  users, sessions, store_settings, customers, sales, sale_items,
  payments, expenses, purchases, purchase_items
from anon, authenticated;

-- ============================================================================
-- DONE — schema only. No product / inventory / user data is inserted here.
-- ============================================================================
