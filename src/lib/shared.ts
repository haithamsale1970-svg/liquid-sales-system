// Client-safe shared helpers, constants and DTO types.

export const CURRENCY = "ج.م";

export const CLIENT_TYPES = {
  store: "محل",
  company: "شركة",
  individual: "فرد",
} as const;
export type ClientType = keyof typeof CLIENT_TYPES;

export const CLIENT_SECTIONS = {
  individuals: "العملاء الأفراد",
  shops: "المحلات والمتاجر",
} as const;
export type ClientSection = keyof typeof CLIENT_SECTIONS;

export function isShopClient(type: ClientType): boolean {
  return type === "store" || type === "company";
}

export const SHIPPING_TYPES = {
  none: "بدون توصيل",
  internal: "توصيل داخلي",
  external: "توصيل خارجي",
} as const;
export type ShippingType = keyof typeof SHIPPING_TYPES;

  // المفاتيح القديمة محفوظة للتوافق مع الفواتير المسجلة سابقًا؛ النصوص الظاهرة وحيدة.
export const PAYMENT_METHODS = {
  cash: "CASH",
  // أسماء المستودع القديمة محفوظة للتوافق مع الفواتير القديمة؛
  // النصوص الظاهرة للمستخدم موحّدة حسب المتطلبات.
  clink_haitham: "QLICK - HAITHAM",
  clink_lahsan: "QLICK - HASAN",
  delivery: "مستحقات شركة التوصيل",
  credit: "آجل (ذمة العميل)",
} as const;
export type PaymentMethod = keyof typeof PAYMENT_METHODS;

export function isPaymentMethod(v: unknown): v is PaymentMethod {
  return v === "cash" || v === "clink_haitham" || v === "clink_lahsan" || v === "delivery" || v === "credit";
}

/**
 * طرق الدفع المتاحة حسب خيار التوصيل المختار:
 * - "مستحقات شركة التوصيل" لا تظهر إطلاقًا بدون توصيل (توصيل = none)،
 *   لأنها لا معنى لها دون شركة توصيل أو تكلفة توصيل.
 * - عند وجود توصيل فعلي (داخلي/خارجي) لا تظهر إلا هذه الطريقة،
 *   لأن كامل الفاتورة تُسجَّل على ذمة شركة التوصيل.
 * - "آجل (ذمة العميل)" متاحة للمدير فقط.
 */
export function availablePaymentMethods(
  shippingType: ShippingType,
  isAdmin: boolean,
): PaymentMethod[] {
  const all = Object.keys(PAYMENT_METHODS) as PaymentMethod[];
  if (shippingType !== "none") return ["delivery"];
  return all.filter((m) => m !== "delivery" && (isAdmin || m !== "credit"));
}

/** خيارات سعر البيع المرتبطة بالمتغير. */
export const PRICE_TYPES = {
  retail: "سعر الأفراد",
  wholesale: "سعر المحلات/الجملة",
} as const;
export type PriceType = keyof typeof PRICE_TYPES;

/** قوائم ثابتة لتفاصيل عبوات المنتجات. */
export const PRODUCT_SIZES = ["10ml", "30ml", "60ml", "100ml", "120ml"] as const;
export type ProductSize = (typeof PRODUCT_SIZES)[number];

export const NICOTINE_LEVELS = ["0mg", "3mg", "6mg", "12mg", "20mg", "30mg", "50mg"] as const;
export type NicotineLevel = (typeof NICOTINE_LEVELS)[number];

export const RETURN_REASONS = [
  "عيب مصنعي",
  "خطأ في الصنف",
  "تغيير رأي العميل",
  "تلف",
  "فرق في المواصفات",
  "أخرى",
] as const;
export type ReturnReason = (typeof RETURN_REASONS)[number];

export const DISCOUNT_TYPES = {
  none: "بدون خصم",
  percent: "نسبة %",
  amount: "مبلغ ثابت",
} as const;
export type DiscountType = keyof typeof DISCOUNT_TYPES;

export const EXPENSE_CATEGORIES = [
  "إيجار",
  "فواتير وخدمات",
  "صيانة",
  "ضيافة ونثريات",
  "رواتب ومكافآت",
  "نقل وتوصيل",
  "تسويق",
  "أخرى",
] as const;

export const ENTITY_COLORS: Record<string, string> = {
  منتج: "mint",
  عميل: "violet",
  فاتورة: "amber",
  مستخدم: "rose",
  نظام: "slate",
  دخول: "sky",
  ديون: "rose",
  مصروف: "amber",
  مرتجع: "violet",
  مخزون: "mint",
};

const nf = new Intl.NumberFormat("ar-EG-u-nu-latn", {
  maximumFractionDigits: 2,
});

const df = new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dtf = new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const rtf = new Intl.RelativeTimeFormat("ar", { numeric: "auto" });

export function fmtNum(n: number): string {
  return nf.format(n || 0);
}

export function fmtMoney(n: number): string {
  return `${nf.format(n || 0)} ${CURRENCY}`;
}

export function fmtDate(d: string | number | Date): string {
  return df.format(new Date(d));
}

export function fmtDateTime(d: string | number | Date): string {
  return dtf.format(new Date(d));
}

export function fmtTime(d: string | number | Date): string {
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

export function relTime(d: string | number | Date): string {
  const diff = new Date(d).getTime() - Date.now();
  const abs = Math.abs(diff);
  const min = 60_000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (abs < min) return "الآن";
  if (abs < hr) return rtf.format(Math.round(diff / min), "minute");
  if (abs < day) return rtf.format(Math.round(diff / hr), "hour");
  if (abs < 30 * day) return rtf.format(Math.round(diff / day), "day");
  return rtf.format(Math.round(diff / (30 * day)), "month");
}

export function invoiceNo(id: number): string {
  return `INV-${String(id).padStart(5, "0")}`;
}

export function cls(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(" ");
}

export function initials(name: string): string {
  return name.trim().slice(0, 2);
}

// ---------- DTO types ----------
export type SessionUserDTO = {
  id: number;
  username: string;
  name: string;
  role: "admin" | "user";
};

export type ProductField = { id?: number; label: string; value: string };

export type ProductVariantDTO = {
  id: number;
  size: string;
  nicotine: string;
  retailPrice: number;
  wholesalePrice: number;
  cost: number;
  stock: number;
  lowStockAt: number;
  active: boolean;
};

export type ProductDTO = {
  id: number;
  name: string;
  category: string;
  description: string;
  price: number;
  cost: number;
  stock: number;
  lowStockAt: number;
  barcode: string;
  imageUrl: string;
  archived: boolean;
  fields: ProductField[];
  variants: ProductVariantDTO[];
  createdAt: string;
};

export type ClientDTO = {
  id: number;
  name: string;
  type: ClientType;
  phone: string;
  /** رقم هاتف ثانٍ — يُستخدم للتواصل ويظهر في البحث السريع بالفاتورة. */
  phone2: string;
  address: string;
  googleMapsUrl: string;
  distributionMapUrl: string;
  notes: string;
  createdAt: string;
  ordersCount: number;
  totalSpent: number;
  /** تاريخ آخر فاتورة مكتملة — للعرض في البحث السريع. */
  lastSaleAt: string | null;
  /** إجمالي المتبقي على العميل (دين) — صفر إن لا يوجد. */
  debt: number;
};

/** تاريخ العميل المختصر — يُعرض في الفاتورة فور اختيار العميل. */
export type ClientHistoryDTO = {
  client: {
    id: number;
    name: string;
    type: ClientType;
    phone: string;
    phone2: string;
    address: string;
    googleMapsUrl: string;
    distributionMapUrl: string;
    notes: string;
    createdAt: string;
    userName?: string;
  };
  stats: {
    orders: number;
    total: number;
    avg: number;
    lastOrderAt: string | null;
    debt: number;
  };
  favorites: Array<{
    productId: number;
    name: string;
    imageUrl: string;
    qty: number;
    revenue: number;
  }>;
  purchases: Array<{
    id: number;
    invoice: string;
    createdAt: string;
    status: string;
    shippingType: ShippingType;
    subtotal: number;
    shippingCost: number;
    total: number;
    userName: string;
    items: Array<{
      productName: string;
      imageUrl: string;
      variantId?: number | null;
      size?: string;
      nicotine?: string;
      priceType?: PriceType;
      quantity: number;
      price: number;
      lineTotal: number;
    }>;
  }>;
};

/** تنبيه انخفاض المخزون المعروض على الشاشة. */
export type LowStockAlertDTO = {
  id: number;
  name: string;
  category: string;
  stock: number;
  lowStockAt: number;
  imageUrl: string;
};

export type SaleListDTO = {
  id: number;
  clientId: number;
  clientName: string;
  clientType: ClientType;
  userName: string;
  status: "completed" | "cancelled";
  subtotal: number;
  shippingType: ShippingType;
  shippingCost: number;
  total: number;
  /** المبلغ الثابت بذمة شركة التوصيل = الإجمالي - سعر التوصيل. */
  deliveryReceivable: number;
  profit: number;
  currency?: string;
  rate?: number;
  itemsCount: number;
  unitsCount: number;
  paymentMethod: PaymentMethod;
  discount: number;
  paid: number;
  createdAt: string;
};

export type SaleItemDTO = {
  id: number;
  productId: number;
  variantId: number | null;
  productName: string;
  imageUrl: string;
  size: string;
  nicotine: string;
  priceType: PriceType;
  price: number;
  quantity: number;
  lineTotal: number;
};

export type SaleDetailDTO = {
  id: number;
  status: "completed" | "cancelled";
  subtotal: number;
  shippingType: ShippingType;
  shippingCost: number;
  total: number;
  profit: number;
  currency?: string;
  rate?: number;
  paymentMethod: PaymentMethod;
  discount: number;
  paid: number;
  remaining: number;
  deliveryReceivable: number;
  returnedQty?: Record<number, number>;
  notes: string;
  createdAt: string;
  client: {
    id: number;
    name: string;
    type: ClientType;
    phone: string;
    phone2: string;
    address: string;
  };
  seller: { id: number; name: string; username: string };
  items: SaleItemDTO[];
  returns?: Array<{
    id: number;
    refund: number;
    method: string;
    reason: string;
    createdAt: string;
  }>;
};

export type ActivityDTO = {
  id: number;
  userName: string;
  action: string;
  entity: string;
  entityId: number | null;
  details: string;
  createdAt: string;
};

// ---------- DTO: الديون وسجل السداد ----------
export type DebtClientDTO = {
  clientId: number;
  name: string;
  type: ClientType;
  phone: string;
  debt: number;
  openSales: number;
  lastSaleAt: string | null;
};

export type DebtSaleDTO = {
  id: number;
  createdAt: string;
  total: number;
  paid: number;
  remaining: number;
  refund?: number;
  paymentMethod: PaymentMethod;
};

export type DebtPaymentDTO = {
  id: number;
  saleId: number | null;
  amount: number;
  method: string;
  note: string;
  userName: string;
  createdAt: string;
};

// ---------- DTO: المصاريف ----------
export type ExpenseDTO = {
  id: number;
  category: string;
  amount: number;
  note: string;
  userName: string;
  createdAt: string;
};

// ---------- DTO: المرتجعات والاستبدال ----------
export type ReturnItemDTO = {
  productId: number;
  saleItemId?: number | null;
  variantId: number | null;
  productName: string;
  size: string;
  nicotine: string;
  priceType: PriceType;
  price: number;
  cost: number;
  quantity: number;
  direction: "in" | "out";
};

export type ReturnDTO = {
  id: number;
  saleId: number;
  clientName: string;
  userName: string;
  refund: number;
  method: string;
  /** سبب الإرجاع/الاستبدال الإلزامي الذي حُفظ في سجل الحركة. */
  reason: string;
  note: string;
  createdAt: string;
  items: ReturnItemDTO[];
};

// ---------- DTO: حركات المخزون ----------
export type InventoryMovementDTO = {
  id: number;
  productId: number;
  variantId: number | null;
  productName: string;
  size: string;
  nicotine: string;
  priceType: PriceType;
  direction: "in" | "out";
  delta: number;
  stockAfter: number;
  reason: string;
  refType: string;
  refId: number | null;
  userName: string;
  note: string;
  createdAt: string;
};
