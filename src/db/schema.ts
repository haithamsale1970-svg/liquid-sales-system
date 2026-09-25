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
  canEditClients: boolean("can_edit_clients").notNull().default(false),
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
    barcode: text("barcode").notNull().default(""),
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

// متغيرات المنتج: كل صف يربط الحجم والنيكوتين بسعر الأفراد والجملة ومخزون مستقل.
// يبقى products.price/stock كقيمة توافقية مجمّعة/احتياطية للمنتجات القديمة.
export const productVariants = pgTable(
  "product_variants",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    size: text("size").notNull(),
    nicotine: text("nicotine").notNull(),
    retailPrice: numeric("retail_price", { precision: 12, scale: 2 }).notNull().default("0"),
    wholesalePrice: numeric("wholesale_price", { precision: 12, scale: 2 }).notNull().default("0"),
    cost: numeric("cost", { precision: 12, scale: 2 }).notNull().default("0"),
    stock: integer("stock").notNull().default(0),
    lowStockAt: integer("low_stock_at").notNull().default(5),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("product_variants_product_idx").on(t.productId),
    index("product_variants_size_nicotine_idx").on(t.productId, t.size, t.nicotine),
  ],
);

export const clients = pgTable(
  "clients",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    type: clientTypeEnum("type").notNull().default("individual"),
    phone: text("phone").notNull().default(""),
    // رقم هاتف ثانٍ (اختياري) — لتسهيل التواصل وتصحيح أرقام العملاء.
    phone2: text("phone2").notNull().default(""),
    address: text("address").notNull().default(""),
    /** رابط Google Maps لعميل من قسم المحلات. */
    googleMapsUrl: text("google_maps_url").notNull().default(""),
    /** رابط خريطة التوزيع الكبرى لقسم المحلات. */
    distributionMapUrl: text("distribution_map_url").notNull().default(""),
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
    /** المبلغ الذي يبقى بذمة شركة التوصيل: الإجمالي - سعر التوصيل. */
    deliveryReceivable: numeric("delivery_receivable", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    profit: numeric("profit", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    // عملة العرض المحفوظة مع الفاتورة (القيم مخزّنة دائمًا بالدينار JOD)
    currency: text("currency").notNull().default("JOD"),
    rate: numeric("rate", { precision: 14, scale: 6 }).notNull().default("1"),
    // طريقة الدفع: CASH / QLICK - HAITHAM / QLICK - HASAN / شركة التوصيل / آجل
    paymentMethod: text("payment_method").notNull().default("cash"),
    // خصم الفاتورة (نسبة أو مبلغ) — يُخصم من الإجمالي ويقلل الربح
    discount: numeric("discount", { precision: 12, scale: 2 }).notNull().default("0"),
    // المدفوع فعليًا؛ NULL = مدفوعة بالكامل (سجلات قديمة قبل إضافة العمود)
    paid: numeric("paid", { precision: 12, scale: 2 }),
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
    // مرجع المتغير وقت البيع؛ nullable للسجلات القديمة.
    variantId: integer("variant_id"),
    productName: text("product_name").notNull(),
    imageUrl: text("image_url").notNull().default(""),
    // لقطة историية ثابتة حتى لا تتغير تفاصيل المرتجع عند تعديل المنتج لاحقًا.
    size: text("size").notNull().default(""),
    nicotine: text("nicotine").notNull().default(""),
    priceType: text("price_type").notNull().default("retail"),
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
  // صلاحية الموظفين (abood / hasan) في إضافة العملاء وتصحيح أرقام هواتفهم
  // وإضافة رقم هاتف ثانٍ. الأدمن يتحكم بها من صفحة الإعدادات.
  allowUsersEditClients: boolean("allow_users_edit_clients")
    .notNull()
    .default(false),
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

// ---------- الديون وسجل سداد العملاء ----------
export const clientPayments = pgTable(
  "client_payments",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id),
    saleId: integer("sale_id").references(() => sales.id),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    method: text("method").notNull().default("cash"),
    note: text("note").notNull().default(""),
    userId: integer("user_id"),
    userName: text("user_name").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("client_payments_client_idx").on(t.clientId),
    index("client_payments_created_idx").on(t.createdAt),
  ],
);

// ---------- المصاريف التشغيلية ----------
export const expenses = pgTable(
  "expenses",
  {
    id: serial("id").primaryKey(),
    category: text("category").notNull().default(""),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    note: text("note").notNull().default(""),
    userId: integer("user_id"),
    userName: text("user_name").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("expenses_created_idx").on(t.createdAt)],
);

// ---------- مرتجعات واستبدال ----------
export const returns = pgTable(
  "returns",
  {
    id: serial("id").primaryKey(),
    saleId: integer("sale_id")
      .notNull()
      .references(() => sales.id),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id),
    userId: integer("user_id"),
    userName: text("user_name").notNull().default(""),
    refund: numeric("refund", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    method: text("method").notNull().default("cash"),
    /** سبب الإرجاع/الاستبدال الإلزامي. */
    reason: text("reason").notNull().default("غير محدد"),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("returns_sale_idx").on(t.saleId),
    index("returns_created_idx").on(t.createdAt),
  ],
);

export const returnItems = pgTable(
  "return_items",
  {
    id: serial("id").primaryKey(),
    returnId: integer("return_id")
      .notNull()
      .references(() => returns.id, { onDelete: "cascade" }),
    saleItemId: integer("sale_item_id"),
    productId: integer("product_id").notNull(),
    // لقطة المتغير/السعر وقت الحركة؛ nullable للتوافق مع السجلات القديمة.
    variantId: integer("variant_id"),
    size: text("size").notNull().default(""),
    nicotine: text("nicotine").notNull().default(""),
    priceType: text("price_type").notNull().default("retail"),
    productName: text("product_name").notNull(),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    // تكلفة الصنف وقت المرتجع/الاستبدال، чтобы يبقى أثر الربح دقيقًا.
    cost: numeric("cost", { precision: 12, scale: 2 }).notNull().default("0"),
    quantity: integer("quantity").notNull(),
    // in = مرتجع يعود للمخزون، out = صنف بديل يخرج في الاستبدال
    direction: text("direction").notNull().default("in"),
  },
  (t) => [index("return_items_return_idx").on(t.returnId)],
);

// ---------- سجل حركات المخزون ----------
export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    variantId: integer("variant_id"),
    size: text("size").notNull().default(""),
    nicotine: text("nicotine").notNull().default(""),
    priceType: text("price_type").notNull().default("retail"),
    productName: text("product_name").notNull(),
    direction: text("direction").notNull(), // in | out
    delta: integer("delta").notNull(),
    stockAfter: integer("stock_after").notNull(),
    reason: text("reason").notNull(),
    refType: text("ref_type").notNull().default(""),
    refId: integer("ref_id"),
    userId: integer("user_id"),
    userName: text("user_name").notNull().default(""),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("inv_movements_product_idx").on(t.productId),
    index("inv_movements_created_idx").on(t.createdAt),
  ],
);
