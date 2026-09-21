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
  product_name text NOT NULL,
  image_url text NOT NULL DEFAULT '',
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