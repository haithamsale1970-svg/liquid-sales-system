/**
 * بنية قاعدة البيانات بصيغة SQL.
 * تُستخدم لتهيئة قاعدة Neon مرة واحدة من نقطة /api/setup دون الحاجة
 * لتشغيل أوامر على جهازك. كل الأوامر آمنة للتكرار (idempotent)،
 * ويجب أن تبقى مطابقة تمامًا لـ src/db/schema.ts.
 */
export const SCHEMA_SQL = `
DO $$ BEGIN
  CREATE TYPE "role" AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "client_type" AS ENUM ('store', 'company', 'individual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "sale_status" AS ENUM ('completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "shipping_type" AS ENUM ('none', 'internal', 'external');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "users" (
  "id" serial PRIMARY KEY NOT NULL,
  "username" text NOT NULL,
  "name" text NOT NULL,
  "password_hash" text NOT NULL,
  "role" "role" DEFAULT 'user' NOT NULL,
  "can_edit_clients" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "users_username_unique" UNIQUE("username")
);

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "sessions_user_idx" ON "sessions" ("user_id");

CREATE TABLE IF NOT EXISTS "products" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "category" text DEFAULT '' NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "price" numeric(12, 2) DEFAULT '0' NOT NULL,
  "cost" numeric(12, 2) DEFAULT '0' NOT NULL,
  "stock" integer DEFAULT 0 NOT NULL,
  "low_stock_at" integer DEFAULT 5 NOT NULL,
  "image_url" text DEFAULT '' NOT NULL,
  "barcode" text DEFAULT '' NOT NULL,
  "archived" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "products_name_idx" ON "products" ("name");

CREATE TABLE IF NOT EXISTS "product_fields" (
  "id" serial PRIMARY KEY NOT NULL,
  "product_id" integer NOT NULL,
  "label" text NOT NULL,
  "value" text NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "product_fields" ADD CONSTRAINT "product_fields_product_id_products_id_fk"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "product_fields_product_idx" ON "product_fields" ("product_id");

CREATE TABLE IF NOT EXISTS "product_variants" (
  "id" serial PRIMARY KEY NOT NULL,
  "product_id" integer NOT NULL,
  "size" text NOT NULL,
  "nicotine" text NOT NULL,
  "retail_price" numeric(12, 2) DEFAULT '0' NOT NULL,
  "wholesale_price" numeric(12, 2) DEFAULT '0' NOT NULL,
  "cost" numeric(12, 2) DEFAULT '0' NOT NULL,
  "stock" integer DEFAULT 0 NOT NULL,
  "low_stock_at" integer DEFAULT 5 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk"
    FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "active" boolean DEFAULT true NOT NULL;
CREATE INDEX IF NOT EXISTS "product_variants_product_idx" ON "product_variants" ("product_id");
CREATE INDEX IF NOT EXISTS "product_variants_size_nicotine_idx" ON "product_variants" ("product_id", "size", "nicotine");

CREATE TABLE IF NOT EXISTS "clients" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "type" "client_type" DEFAULT 'individual' NOT NULL,
  "phone" text DEFAULT '' NOT NULL,
  "phone2" text DEFAULT '' NOT NULL,
  "address" text DEFAULT '' NOT NULL,
  "google_maps_url" text DEFAULT '' NOT NULL,
  "distribution_map_url" text DEFAULT '' NOT NULL,
  "notes" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "clients_name_idx" ON "clients" ("name");

CREATE TABLE IF NOT EXISTS "sales" (
  "id" serial PRIMARY KEY NOT NULL,
  "client_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "status" "sale_status" DEFAULT 'completed' NOT NULL,
  "subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
  "shipping_type" "shipping_type" DEFAULT 'none' NOT NULL,
  "shipping_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
  "total" numeric(12, 2) DEFAULT '0' NOT NULL,
  "delivery_receivable" numeric(12, 2) DEFAULT '0' NOT NULL,
  "profit" numeric(12, 2) DEFAULT '0' NOT NULL,
  "currency" text DEFAULT 'JOD' NOT NULL,
  "rate" numeric(14, 6) DEFAULT '1' NOT NULL,
  "notes" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "sales" ADD CONSTRAINT "sales_client_id_clients_id_fk"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "sales" ADD CONSTRAINT "sales_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "sales_created_idx" ON "sales" ("created_at");
CREATE INDEX IF NOT EXISTS "sales_client_idx" ON "sales" ("client_id");

CREATE TABLE IF NOT EXISTS "sale_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "sale_id" integer NOT NULL,
  "product_id" integer NOT NULL,
  "variant_id" integer,
  "product_name" text NOT NULL,
  "image_url" text DEFAULT '' NOT NULL,
  "size" text DEFAULT '' NOT NULL,
  "nicotine" text DEFAULT '' NOT NULL,
  "price_type" text DEFAULT 'retail' NOT NULL,
  "price" numeric(12, 2) NOT NULL,
  "cost" numeric(12, 2) DEFAULT '0' NOT NULL,
  "quantity" integer NOT NULL,
  "line_total" numeric(12, 2) NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk"
    FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_products_id_fk"
    FOREIGN KEY ("product_id") REFERENCES "products"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "sale_items_sale_idx" ON "sale_items" ("sale_id");

CREATE TABLE IF NOT EXISTS "activity_logs" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer,
  "user_name" text DEFAULT 'النظام' NOT NULL,
  "action" text NOT NULL,
  "entity" text NOT NULL,
  "entity_id" integer,
  "details" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "activity_created_idx" ON "activity_logs" ("created_at");

CREATE TABLE IF NOT EXISTS "app_settings" (
  "id" integer PRIMARY KEY NOT NULL,
  "default_currency" text DEFAULT 'JOD' NOT NULL,
  "rate_usd" numeric(14, 6) DEFAULT '1.41' NOT NULL,
  "rate_egp" numeric(14, 6) DEFAULT '67.5' NOT NULL,
  "shipping_internal" numeric(12, 2) DEFAULT '1.5' NOT NULL,
  "shipping_external" numeric(12, 2) DEFAULT '2' NOT NULL,
  "show_reports_for_users" boolean DEFAULT true NOT NULL,
  "show_clients_for_users" boolean DEFAULT true NOT NULL,
  "show_products_for_users" boolean DEFAULT true NOT NULL,
  "allow_users_edit_clients" boolean DEFAULT false NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

INSERT INTO "app_settings" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'JOD' NOT NULL;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "rate" numeric(14, 6) DEFAULT '1' NOT NULL;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "payment_method" text DEFAULT 'cash' NOT NULL;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "discount" numeric(12, 2) DEFAULT '0' NOT NULL;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "paid" numeric(12, 2);
ALTER TABLE "sale_items" ADD COLUMN IF NOT EXISTS "cost" numeric(12, 2) DEFAULT '0' NOT NULL;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "barcode" text DEFAULT '' NOT NULL;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "phone2" text DEFAULT '' NOT NULL;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "allow_users_edit_clients" boolean DEFAULT false NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "can_edit_clients" boolean DEFAULT false NOT NULL;
CREATE TABLE IF NOT EXISTS "client_payments" (
  "id" serial PRIMARY KEY NOT NULL,
  "client_id" integer NOT NULL,
  "sale_id" integer,
  "amount" numeric(12, 2) NOT NULL,
  "method" text DEFAULT 'cash' NOT NULL,
  "note" text DEFAULT '' NOT NULL,
  "user_id" integer,
  "user_name" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_client_id_clients_id_fk"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_sale_id_sales_id_fk"
    FOREIGN KEY ("sale_id") REFERENCES "sales"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "client_payments_client_idx" ON "client_payments" ("client_id");
CREATE INDEX IF NOT EXISTS "client_payments_created_idx" ON "client_payments" ("created_at");

CREATE TABLE IF NOT EXISTS "expenses" (
  "id" serial PRIMARY KEY NOT NULL,
  "category" text DEFAULT '' NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "note" text DEFAULT '' NOT NULL,
  "user_id" integer,
  "user_name" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "expenses_created_idx" ON "expenses" ("created_at");

CREATE TABLE IF NOT EXISTS "returns" (
  "id" serial PRIMARY KEY NOT NULL,
  "sale_id" integer NOT NULL,
  "client_id" integer NOT NULL,
  "user_id" integer,
  "user_name" text DEFAULT '' NOT NULL,
  "refund" numeric(12, 2) DEFAULT '0' NOT NULL,
  "method" text DEFAULT 'cash' NOT NULL,
  "reason" text DEFAULT 'غير محدد' NOT NULL,
  "note" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "returns" ADD COLUMN IF NOT EXISTS "method" text DEFAULT 'cash' NOT NULL;
ALTER TABLE "returns" ADD COLUMN IF NOT EXISTS "reason" text DEFAULT 'غير محدد' NOT NULL;

DO $$ BEGIN
  ALTER TABLE "returns" ADD CONSTRAINT "returns_sale_id_sales_id_fk"
    FOREIGN KEY ("sale_id") REFERENCES "sales"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "returns" ADD CONSTRAINT "returns_client_id_clients_id_fk"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "returns_sale_idx" ON "returns" ("sale_id");
CREATE INDEX IF NOT EXISTS "returns_created_idx" ON "returns" ("created_at");

CREATE TABLE IF NOT EXISTS "return_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "return_id" integer NOT NULL,
  "sale_item_id" integer,
  "product_id" integer NOT NULL,
  "variant_id" integer,
  "size" text DEFAULT '' NOT NULL,
  "nicotine" text DEFAULT '' NOT NULL,
  "price_type" text DEFAULT 'retail' NOT NULL,
  "product_name" text NOT NULL,
  "price" numeric(12, 2) NOT NULL,
  "cost" numeric(12, 2) DEFAULT '0' NOT NULL,
  "quantity" integer NOT NULL,
  "direction" text DEFAULT 'in' NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "return_items" ADD CONSTRAINT "return_items_return_id_returns_id_fk"
    FOREIGN KEY ("return_id") REFERENCES "returns"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "return_items_return_idx" ON "return_items" ("return_id");
ALTER TABLE "return_items" ADD COLUMN IF NOT EXISTS "cost" numeric(12, 2) DEFAULT '0' NOT NULL;

CREATE TABLE IF NOT EXISTS "inventory_movements" (
  "id" serial PRIMARY KEY NOT NULL,
  "product_id" integer NOT NULL,
  "variant_id" integer,
  "size" text DEFAULT '' NOT NULL,
  "nicotine" text DEFAULT '' NOT NULL,
  "price_type" text DEFAULT 'retail' NOT NULL,
  "product_name" text NOT NULL,
  "direction" text NOT NULL,
  "delta" integer NOT NULL,
  "stock_after" integer NOT NULL,
  "reason" text NOT NULL,
  "ref_type" text DEFAULT '' NOT NULL,
  "ref_id" integer,
  "user_id" integer,
  "user_name" text DEFAULT '' NOT NULL,
  "note" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_products_id_fk"
    FOREIGN KEY ("product_id") REFERENCES "products"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "inv_movements_product_idx" ON "inventory_movements" ("product_id");
CREATE INDEX IF NOT EXISTS "inv_movements_created_idx" ON "inventory_movements" ("created_at");

-- ترقية القواعد القديمة بأمان (لا تحذف أي بيانات).
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "delivery_receivable" numeric(12, 2) DEFAULT '0' NOT NULL;
ALTER TABLE "sale_items" ADD COLUMN IF NOT EXISTS "variant_id" integer;
ALTER TABLE "sale_items" ADD COLUMN IF NOT EXISTS "size" text DEFAULT '' NOT NULL;
ALTER TABLE "sale_items" ADD COLUMN IF NOT EXISTS "nicotine" text DEFAULT '' NOT NULL;
ALTER TABLE "sale_items" ADD COLUMN IF NOT EXISTS "price_type" text DEFAULT 'retail' NOT NULL;
ALTER TABLE "returns" ADD COLUMN IF NOT EXISTS "reason" text DEFAULT 'غير محدد' NOT NULL;
ALTER TABLE "return_items" ADD COLUMN IF NOT EXISTS "sale_item_id" integer;
ALTER TABLE "return_items" ADD COLUMN IF NOT EXISTS "variant_id" integer;
ALTER TABLE "return_items" ADD COLUMN IF NOT EXISTS "size" text DEFAULT '' NOT NULL;
ALTER TABLE "return_items" ADD COLUMN IF NOT EXISTS "nicotine" text DEFAULT '' NOT NULL;
ALTER TABLE "return_items" ADD COLUMN IF NOT EXISTS "price_type" text DEFAULT 'retail' NOT NULL;
ALTER TABLE "inventory_movements" ADD COLUMN IF NOT EXISTS "variant_id" integer;
ALTER TABLE "inventory_movements" ADD COLUMN IF NOT EXISTS "size" text DEFAULT '' NOT NULL;
ALTER TABLE "inventory_movements" ADD COLUMN IF NOT EXISTS "nicotine" text DEFAULT '' NOT NULL;
ALTER TABLE "inventory_movements" ADD COLUMN IF NOT EXISTS "price_type" text DEFAULT 'retail' NOT NULL;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "google_maps_url" text DEFAULT '' NOT NULL;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "distribution_map_url" text DEFAULT '' NOT NULL;
`;
