/*
# Create full application schema for سُحُب (SOHOB) liquid management system

## Overview
This migration creates all tables needed for the sales/inventory management app.
The app uses its own session-based auth (not Supabase Auth), so tables are
accessed via the service role key from the server-side API routes.

## Tables created:
1. **users** — app users (admin/staff) with bcrypt-hashed passwords
2. **sessions** — login session tokens
3. **products** — inventory items (e-liquid products)
4. **product_fields** — extra key-value attributes per product
5. **clients** — customers (stores, companies, individuals)
6. **sales** — invoices/orders
7. **sale_items** — line items per sale
8. **activity_logs** — audit trail of all actions

## Enums:
- role: admin | user
- client_type: store | company | individual
- sale_status: completed | cancelled
- shipping_type: none | internal | external

## Security:
- RLS enabled on all tables
- Policies allow anon+authenticated full access (app uses service role key server-side,
  and the anon key is used from the browser via API routes which run server-side)

## Notes:
- All timestamp columns use timestamptz with default now()
- Serial IDs used for all primary keys (matching Drizzle schema)
- Indexes created for frequently queried columns
*/

-- ============== ENUMS ==============
DO $$ BEGIN
  CREATE TYPE role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE client_type AS ENUM ('store', 'company', 'individual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sale_status AS ENUM ('completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE shipping_type AS ENUM ('none', 'internal', 'external');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============== USERS ==============
CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY,
  username text NOT NULL UNIQUE,
  name text NOT NULL,
  password_hash text NOT NULL,
  role role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_users" ON users;
CREATE POLICY "anon_select_users" ON users FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_users" ON users;
CREATE POLICY "anon_insert_users" ON users FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_users" ON users;
CREATE POLICY "anon_update_users" ON users FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_users" ON users;
CREATE POLICY "anon_delete_users" ON users FOR DELETE TO anon, authenticated USING (true);

-- ============== SESSIONS ==============
CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_sessions" ON sessions;
CREATE POLICY "anon_select_sessions" ON sessions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_sessions" ON sessions;
CREATE POLICY "anon_insert_sessions" ON sessions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_sessions" ON sessions;
CREATE POLICY "anon_update_sessions" ON sessions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_sessions" ON sessions;
CREATE POLICY "anon_delete_sessions" ON sessions FOR DELETE TO anon, authenticated USING (true);

-- ============== PRODUCTS ==============
CREATE TABLE IF NOT EXISTS products (
  id serial PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  price numeric(12,2) NOT NULL DEFAULT '0',
  cost numeric(12,2) NOT NULL DEFAULT '0',
  stock integer NOT NULL DEFAULT 0,
  low_stock_at integer NOT NULL DEFAULT 5,
  image_url text NOT NULL DEFAULT '',
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_name_idx ON products(name);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_products" ON products;
CREATE POLICY "anon_select_products" ON products FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_products" ON products;
CREATE POLICY "anon_insert_products" ON products FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_products" ON products;
CREATE POLICY "anon_update_products" ON products FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_products" ON products;
CREATE POLICY "anon_delete_products" ON products FOR DELETE TO anon, authenticated USING (true);

-- ============== PRODUCT FIELDS ==============
CREATE TABLE IF NOT EXISTS product_fields (
  id serial PRIMARY KEY,
  product_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label text NOT NULL,
  value text NOT NULL
);

CREATE INDEX IF NOT EXISTS product_fields_product_idx ON product_fields(product_id);

ALTER TABLE product_fields ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_product_fields" ON product_fields;
CREATE POLICY "anon_select_product_fields" ON product_fields FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_product_fields" ON product_fields;
CREATE POLICY "anon_insert_product_fields" ON product_fields FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_product_fields" ON product_fields;
CREATE POLICY "anon_update_product_fields" ON product_fields FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_product_fields" ON product_fields;
CREATE POLICY "anon_delete_product_fields" ON product_fields FOR DELETE TO anon, authenticated USING (true);

-- ============== CLIENTS ==============
CREATE TABLE IF NOT EXISTS clients (
  id serial PRIMARY KEY,
  name text NOT NULL,
  type client_type NOT NULL DEFAULT 'individual',
  phone text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clients_name_idx ON clients(name);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_clients" ON clients;
CREATE POLICY "anon_select_clients" ON clients FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_clients" ON clients;
CREATE POLICY "anon_insert_clients" ON clients FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_clients" ON clients;
CREATE POLICY "anon_update_clients" ON clients FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_clients" ON clients;
CREATE POLICY "anon_delete_clients" ON clients FOR DELETE TO anon, authenticated USING (true);

-- ============== SALES ==============
CREATE TABLE IF NOT EXISTS sales (
  id serial PRIMARY KEY,
  client_id integer NOT NULL REFERENCES clients(id),
  user_id integer NOT NULL REFERENCES users(id),
  status sale_status NOT NULL DEFAULT 'completed',
  subtotal numeric(12,2) NOT NULL DEFAULT '0',
  shipping_type shipping_type NOT NULL DEFAULT 'none',
  shipping_cost numeric(12,2) NOT NULL DEFAULT '0',
  total numeric(12,2) NOT NULL DEFAULT '0',
  delivery_receivable numeric(12,2) NOT NULL DEFAULT '0',
  profit numeric(12,2) NOT NULL DEFAULT '0',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_created_idx ON sales(created_at);
CREATE INDEX IF NOT EXISTS sales_client_idx ON sales(client_id);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_sales" ON sales;
CREATE POLICY "anon_select_sales" ON sales FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_sales" ON sales;
CREATE POLICY "anon_insert_sales" ON sales FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_sales" ON sales;
CREATE POLICY "anon_update_sales" ON sales FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_sales" ON sales;
CREATE POLICY "anon_delete_sales" ON sales FOR DELETE TO anon, authenticated USING (true);

-- ============== SALE ITEMS ==============
CREATE TABLE IF NOT EXISTS sale_items (
  id serial PRIMARY KEY,
  sale_id integer NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id integer NOT NULL REFERENCES products(id),
  variant_id integer,
  product_name text NOT NULL,
  image_url text NOT NULL DEFAULT '',
  size text NOT NULL DEFAULT '',
  nicotine text NOT NULL DEFAULT '',
  price_type text NOT NULL DEFAULT 'retail',
  price numeric(12,2) NOT NULL,
  cost numeric(12,2) NOT NULL DEFAULT '0',
  quantity integer NOT NULL,
  line_total numeric(12,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS sale_items_sale_idx ON sale_items(sale_id);

ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_sale_items" ON sale_items;
CREATE POLICY "anon_select_sale_items" ON sale_items FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_sale_items" ON sale_items;
CREATE POLICY "anon_insert_sale_items" ON sale_items FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_sale_items" ON sale_items;
CREATE POLICY "anon_update_sale_items" ON sale_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_sale_items" ON sale_items;
CREATE POLICY "anon_delete_sale_items" ON sale_items FOR DELETE TO anon, authenticated USING (true);

-- ============== ACTIVITY LOGS ==============
CREATE TABLE IF NOT EXISTS activity_logs (
  id serial PRIMARY KEY,
  user_id integer,
  user_name text NOT NULL DEFAULT 'النظام',
  action text NOT NULL,
  entity text NOT NULL,
  entity_id integer,
  details text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_created_idx ON activity_logs(created_at);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_activity_logs" ON activity_logs;
CREATE POLICY "anon_select_activity_logs" ON activity_logs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_activity_logs" ON activity_logs;
CREATE POLICY "anon_insert_activity_logs" ON activity_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_activity_logs" ON activity_logs;
CREATE POLICY "anon_update_activity_logs" ON activity_logs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_activity_logs" ON activity_logs;
CREATE POLICY "anon_delete_activity_logs" ON activity_logs FOR DELETE TO anon, authenticated USING (true);

-- ============== PRODUCT VARIANTS ==============
CREATE TABLE IF NOT EXISTS product_variants (
  id serial PRIMARY KEY,
  product_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size text NOT NULL,
  nicotine text NOT NULL,
  retail_price numeric(12,2) NOT NULL DEFAULT '0',
  wholesale_price numeric(12,2) NOT NULL DEFAULT '0',
  cost numeric(12,2) NOT NULL DEFAULT '0',
  stock integer NOT NULL DEFAULT 0,
  low_stock_at integer NOT NULL DEFAULT 5,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS product_variants_product_idx ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS product_variants_size_nicotine_idx ON product_variants(product_id, size, nicotine);
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_product_variants" ON product_variants;
CREATE POLICY "anon_select_product_variants" ON product_variants FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_product_variants" ON product_variants;
CREATE POLICY "anon_insert_product_variants" ON product_variants FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_product_variants" ON product_variants;
CREATE POLICY "anon_update_product_variants" ON product_variants FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_product_variants" ON product_variants;
CREATE POLICY "anon_delete_product_variants" ON product_variants FOR DELETE TO anon, authenticated USING (true);

-- ============== RETURNS ==============
CREATE TABLE IF NOT EXISTS returns (
  id serial PRIMARY KEY,
  sale_id integer NOT NULL REFERENCES sales(id),
  client_id integer NOT NULL REFERENCES clients(id),
  user_id integer,
  user_name text NOT NULL DEFAULT '',
  refund numeric(12,2) NOT NULL DEFAULT '0',
  method text NOT NULL DEFAULT 'cash',
  reason text NOT NULL DEFAULT 'غير محدد',
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE returns ADD COLUMN IF NOT EXISTS method text NOT NULL DEFAULT 'cash';
ALTER TABLE returns ADD COLUMN IF NOT EXISTS reason text NOT NULL DEFAULT 'غير محدد';
CREATE INDEX IF NOT EXISTS returns_sale_idx ON returns(sale_id);
CREATE INDEX IF NOT EXISTS returns_created_idx ON returns(created_at);
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_returns" ON returns;
CREATE POLICY "anon_select_returns" ON returns FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_returns" ON returns;
CREATE POLICY "anon_insert_returns" ON returns FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_returns" ON returns;
CREATE POLICY "anon_update_returns" ON returns FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_returns" ON returns;
CREATE POLICY "anon_delete_returns" ON returns FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS return_items (
  id serial PRIMARY KEY,
  return_id integer NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  sale_item_id integer,
  product_id integer NOT NULL REFERENCES products(id),
  variant_id integer,
  size text NOT NULL DEFAULT '',
  nicotine text NOT NULL DEFAULT '',
  price_type text NOT NULL DEFAULT 'retail',
  product_name text NOT NULL,
  price numeric(12,2) NOT NULL,
  cost numeric(12,2) NOT NULL DEFAULT '0',
  quantity integer NOT NULL,
  direction text NOT NULL DEFAULT 'in'
);
CREATE INDEX IF NOT EXISTS return_items_return_idx ON return_items(return_id);
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_return_items" ON return_items;
CREATE POLICY "anon_select_return_items" ON return_items FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_return_items" ON return_items;
CREATE POLICY "anon_insert_return_items" ON return_items FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_return_items" ON return_items;
CREATE POLICY "anon_update_return_items" ON return_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_return_items" ON return_items;
CREATE POLICY "anon_delete_return_items" ON return_items FOR DELETE TO anon, authenticated USING (true);

-- ============== STOCK MOVEMENTS ==============
CREATE TABLE IF NOT EXISTS inventory_movements (
  id serial PRIMARY KEY,
  product_id integer NOT NULL REFERENCES products(id),
  variant_id integer,
  size text NOT NULL DEFAULT '',
  nicotine text NOT NULL DEFAULT '',
  price_type text NOT NULL DEFAULT 'retail',
  product_name text NOT NULL,
  direction text NOT NULL,
  delta integer NOT NULL,
  stock_after integer NOT NULL,
  reason text NOT NULL,
  ref_type text NOT NULL DEFAULT '',
  ref_id integer,
  user_id integer,
  user_name text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inventory_movements_product_idx ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS inventory_movements_created_idx ON inventory_movements(created_at);
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_inventory_movements" ON inventory_movements;
CREATE POLICY "anon_select_inventory_movements" ON inventory_movements FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_inventory_movements" ON inventory_movements;
CREATE POLICY "anon_insert_inventory_movements" ON inventory_movements FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_inventory_movements" ON inventory_movements;
CREATE POLICY "anon_update_inventory_movements" ON inventory_movements FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_inventory_movements" ON inventory_movements;
CREATE POLICY "anon_delete_inventory_movements" ON inventory_movements FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS return_items_return_idx ON return_items(return_id);
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_return_items" ON return_items;
CREATE POLICY "anon_select_return_items" ON return_items FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_return_items" ON return_items;
CREATE POLICY "anon_insert_return_items" ON return_items FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_return_items" ON return_items;
CREATE POLICY "anon_update_return_items" ON return_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_return_items" ON return_items;
CREATE POLICY "anon_delete_return_items" ON return_items FOR DELETE TO anon, authenticated USING (true);

-- Safe upgrades for existing databases.
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_edit_clients boolean NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode text NOT NULL DEFAULT '';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone2 text NOT NULL DEFAULT '';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_receivable numeric(12,2) NOT NULL DEFAULT '0';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'JOD';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS rate numeric(14,6) NOT NULL DEFAULT '1';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cash';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount numeric(12,2) NOT NULL DEFAULT '0';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS paid numeric(12,2);
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS cost numeric(12,2) NOT NULL DEFAULT '0';
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS variant_id integer;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS size text NOT NULL DEFAULT '';
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS nicotine text NOT NULL DEFAULT '';
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS price_type text NOT NULL DEFAULT 'retail';
ALTER TABLE return_items ADD COLUMN IF NOT EXISTS sale_item_id integer;
ALTER TABLE return_items ADD COLUMN IF NOT EXISTS variant_id integer;
ALTER TABLE return_items ADD COLUMN IF NOT EXISTS size text NOT NULL DEFAULT '';
ALTER TABLE return_items ADD COLUMN IF NOT EXISTS nicotine text NOT NULL DEFAULT '';
ALTER TABLE return_items ADD COLUMN IF NOT EXISTS price_type text NOT NULL DEFAULT 'retail';
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS variant_id integer;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS size text NOT NULL DEFAULT '';
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS nicotine text NOT NULL DEFAULT '';
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS price_type text NOT NULL DEFAULT 'retail';