import {
  pgTable,
  pgEnum,
  serial,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["admin", "user"]);
export const clientTypeEnum = pgEnum("client_type", [
  "store",
  "company",
  "individual",
]);
export const saleStatusEnum = pgEnum("sale_status", ["completed", "cancelled"]);
export const shippingTypeEnum = pgEnum("shipping_type", [
  "none",
  "internal",
  "external",
]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    category: text("category").notNull().default(""),
    description: text("description").notNull().default(""),
    price: numeric("price", { precision: 12, scale: 2 }).notNull().default("0"),
    cost: numeric("cost", { precision: 12, scale: 2 }).notNull().default("0"),
    stock: integer("stock").notNull().default(0),
    lowStockAt: integer("low_stock_at").notNull().default(5),
    imageUrl: text("image_url").notNull().default(""),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("products_name_idx").on(t.name)],
);

export const productFields = pgTable(
  "product_fields",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    value: text("value").notNull(),
  },
  (t) => [index("product_fields_product_idx").on(t.productId)],
);

export const clients = pgTable(
  "clients",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    type: clientTypeEnum("type").notNull().default("individual"),
    phone: text("phone").notNull().default(""),
    address: text("address").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("clients_name_idx").on(t.name)],
);

export const sales = pgTable(
  "sales",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    status: saleStatusEnum("status").notNull().default("completed"),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    shippingType: shippingTypeEnum("shipping_type").notNull().default("none"),
    shippingCost: numeric("shipping_cost", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
    profit: numeric("profit", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    // عملة العرض المحفوظة مع الفاتورة (القيم مخزّنة دائمًا بالدينار JOD)
    currency: text("currency").notNull().default("JOD"),
    rate: numeric("rate", { precision: 14, scale: 6 }).notNull().default("1"),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("sales_created_idx").on(t.createdAt),
    index("sales_client_idx").on(t.clientId),
  ],
);

export const saleItems = pgTable(
  "sale_items",
  {
    id: serial("id").primaryKey(),
    saleId: integer("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    productName: text("product_name").notNull(),
    imageUrl: text("image_url").notNull().default(""),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    cost: numeric("cost", { precision: 12, scale: 2 }).notNull().default("0"),
    quantity: integer("quantity").notNull(),
    lineTotal: numeric("line_total", { precision: 12, scale: 2 }).notNull(),
  },
  (t) => [index("sale_items_sale_idx").on(t.saleId)],
);

// ---------- إعدادات النظام العامة (صف واحد id=1) ----------
// يتحكم بها الأدمن فقط: العملة الافتراضية + أسعار الصرف + التوصيل + إظهار الأقسام.
export const appSettings = pgTable("app_settings", {
  id: integer("id").primaryKey(),
  defaultCurrency: text("default_currency").notNull().default("JOD"),
  rateUsd: numeric("rate_usd", { precision: 14, scale: 6 }).notNull().default("1.41"),
  rateEgp: numeric("rate_egp", { precision: 14, scale: 6 }).notNull().default("67.5"),
  shippingInternal: numeric("shipping_internal", { precision: 12, scale: 2 }).notNull().default("1.5"),
  shippingExternal: numeric("shipping_external", { precision: 12, scale: 2 }).notNull().default("2"),
  showReportsForUsers: boolean("show_reports_for_users").notNull().default(true),
  showClientsForUsers: boolean("show_clients_for_users").notNull().default(true),
  showProductsForUsers: boolean("show_products_for_users").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id"),
    userName: text("user_name").notNull().default("النظام"),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: integer("entity_id"),
    details: text("details").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("activity_created_idx").on(t.createdAt)],
);
