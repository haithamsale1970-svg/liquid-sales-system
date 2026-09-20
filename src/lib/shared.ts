// Client-safe shared helpers, constants and DTO types.

export const CURRENCY = "ج.م";

export const CLIENT_TYPES = {
  store: "محل",
  company: "شركة",
  individual: "فرد",
} as const;
export type ClientType = keyof typeof CLIENT_TYPES;

export const SHIPPING_TYPES = {
  none: "بدون شحن",
  internal: "شحن داخلي",
  external: "شحن خارجي",
} as const;
export type ShippingType = keyof typeof SHIPPING_TYPES;

export const ENTITY_COLORS: Record<string, string> = {
  منتج: "mint",
  عميل: "violet",
  فاتورة: "amber",
  مستخدم: "rose",
  نظام: "slate",
  دخول: "sky",
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

export type ProductDTO = {
  id: number;
  name: string;
  category: string;
  description: string;
  price: number;
  cost: number;
  stock: number;
  lowStockAt: number;
  imageUrl: string;
  archived: boolean;
  fields: ProductField[];
  createdAt: string;
};

export type ClientDTO = {
  id: number;
  name: string;
  type: ClientType;
  phone: string;
  address: string;
  notes: string;
  createdAt: string;
  ordersCount: number;
  totalSpent: number;
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
  profit: number;
  itemsCount: number;
  unitsCount: number;
  createdAt: string;
};

export type SaleItemDTO = {
  id: number;
  productId: number;
  productName: string;
  imageUrl: string;
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
  notes: string;
  createdAt: string;
  client: {
    id: number;
    name: string;
    type: ClientType;
    phone: string;
    address: string;
  };
  seller: { id: number; name: string; username: string };
  items: SaleItemDTO[];
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
