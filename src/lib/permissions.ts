/**
 * نظام الصلاحيات المتقدم (Advanced RBAC & Permissions).
 *
 * مصدر واحد للحقيقة (single source of truth) يحدّد:
 *  - المجموعات (الصفحات/الأقسام) المتاحة في النظام.
 *  - الإجراءات المسموح بها داخل كل مجموعة (عرض / إضافة / تعديل / حذف).
 *  - صلاحيات دقيقة إضافية لا ترتبط بمجموعة واحدة (الخصم، الآجل، الأرباح...).
 *
 * الملف آمن للاستيراد من الخادم والواجهة معًا لأنه لا يعتمد على قاعدة البيانات.
 */

// ---------- الإجراءات ----------
export const PERMISSION_ACTIONS = {
  view: "عرض",
  create: "إضافة",
  update: "تعديل",
  delete: "حذف",
} as const;
export type PermissionAction = keyof typeof PERMISSION_ACTIONS;

// ---------- مجموعات الصلاحيات (الصفحات) ----------
export const PERMISSION_GROUP_KEYS = [
  "dashboard",
  "products",
  "sales",
  "clients",
  "debts",
  "expenses",
  "inventory",
  "returns",
  "reports",
  "users",
  "activity",
  "settings",
] as const;
export type PermissionGroupKey = (typeof PERMISSION_GROUP_KEYS)[number];

export type GroupPermissionKey = `${PermissionGroupKey}.${PermissionAction}`;

export type PermissionGroup = {
  key: PermissionGroupKey;
  label: string;
  hint: string;
  actions: readonly PermissionAction[];
};

export const PERMISSION_GROUPS: readonly PermissionGroup[] = [
  { key: "dashboard", label: "لوحة التحكم", hint: "الملخص العام وحركة اليوم", actions: ["view"] },
  { key: "products", label: "الأصناف والمخزون", hint: "المنتجات والمتغيرات والكميات", actions: ["view", "create", "update", "delete"] },
  { key: "sales", label: "الفواتير", hint: "إنشاء الفواتير وعرضها وإلغاؤها", actions: ["view", "create", "update", "delete"] },
  { key: "clients", label: "العملاء", hint: "بيانات العملاء والإضافات السريعة", actions: ["view", "create", "update", "delete"] },
  { key: "debts", label: "الديون والتحصيل", hint: "متابعة الديون وتسجيل السداد", actions: ["view", "create", "delete"] },
  { key: "expenses", label: "المصاريف", hint: "مصروفات التشغيل", actions: ["view", "create", "delete"] },
  { key: "inventory", label: "حركة المخزون", hint: "سجل دخول وخروج الكميات", actions: ["view", "create", "delete"] },
  { key: "returns", label: "المرتجعات والاستبدال", hint: "إرجاع أو استبدال أصناف مباعة", actions: ["view", "create", "delete"] },
  { key: "reports", label: "التقارير", hint: "تقارير المبيعات والأرباح", actions: ["view"] },
  { key: "users", label: "المستخدمون", hint: "إنشاء الحسابات وضبط صلاحياتها", actions: ["view", "create", "update", "delete"] },
  { key: "activity", label: "سجل النشاط", hint: "سجل عمليات المستخدمين", actions: ["view"] },
  { key: "settings", label: "الإعدادات والنسخ", hint: "إعدادات النظام والنسخ الاحتياطي", actions: ["view", "update"] },
];

// ---------- صلاحيات دقيقة إضافية ----------
export type ExtraPermissionKey =
  | "sales.discount"
  | "sales.credit"
  | "finances.view_profit"
  | "finances.view_cost"
  | "backup.manage";

export type PermissionKey = GroupPermissionKey | ExtraPermissionKey;

export type ExtraPermission = {
  key: ExtraPermissionKey;
  label: string;
  hint: string;
};

export const EXTRA_PERMISSIONS: readonly ExtraPermission[] = [
  { key: "sales.discount", label: "تطبيق الخصم على الفاتورة", hint: "السماح بمنح خصم للأصناف أو على إجمالي الفاتورة" },
  { key: "sales.credit", label: "البيع الآجل (ذمة العميل)", hint: "إظهار خيار الدفع الآجل في الفاتورة الجديدة" },
  { key: "finances.view_profit", label: "الاطلاع على الأرباح", hint: "إظهار هامش الربح في الفواتير والتقارير" },
  { key: "finances.view_cost", label: "الاطلاع على التكاليف", hint: "إظهار سعر التكلفة وبيانات الكلفة" },
  { key: "backup.manage", label: "النسخ الاحتياطي والاستعادة", hint: "تنزيل نسخة احتياطية أو استعادتها" },
];

// ---------- القائمة الكاملة للمفاتيح ----------
export const ALL_PERMISSION_KEYS: readonly PermissionKey[] = [
  ...PERMISSION_GROUPS.flatMap((g) =>
    g.actions.map((a) => `${g.key}.${a}` as GroupPermissionKey),
  ),
  ...EXTRA_PERMISSIONS.map((e) => e.key),
];

export const PERMISSION_KEY_SET: ReadonlySet<string> = new Set(ALL_PERMISSION_KEYS);


// ---------- التحقق من صلاحية المفتاح ----------
export function isPermissionKey(v: unknown): v is PermissionKey {
  return typeof v === "string" && PERMISSION_KEY_SET.has(v);
}

const GROUP_LABEL = new Map<string, string>(
  PERMISSION_GROUPS.map((g) => [g.key, g.label]),
);
const EXTRA_LABEL = new Map<string, string>(
  EXTRA_PERMISSIONS.map((e) => [e.key, e.label]),
);

/** اسم مقروء للصلاحية — يُستخدم في الرسائل وسجل النشاط. */
export function permissionLabel(key: string): string {
  if (EXTRA_LABEL.has(key)) return EXTRA_LABEL.get(key)!;
  const [group, action] = key.split(".");
  const gLabel = GROUP_LABEL.get(group);
  if (gLabel && action && action in PERMISSION_ACTIONS) {
    return `${gLabel} — ${PERMISSION_ACTIONS[action as PermissionAction]}`;
  }
  return key;
}

// ---------- تمثيل الصلاحيات ----------
/** خريطة صلاحيات المستخدم: المفتاح -> ممنوع/مسموح. المفاتيح غير الممنوحة = false. */
export type Permissions = Record<string, boolean>;

export function emptyPermissions(): Permissions {
  return {};
}

/** خريطة كل الصلاحيات مفعّلة (تُستخدم للمدير الذي يملك كل شيء). */
export function allPermissions(): Permissions {
  const out: Permissions = {};
  for (const k of ALL_PERMISSION_KEYS) out[k] = true;
  return out;
}

/** يبني خريطة صلاحيات من مصفوفة مفاتيح ممنوحة. */
export function permissionsFromList(list: Iterable<unknown>): Permissions {
  const out: Permissions = {};
  for (const k of list) if (isPermissionKey(k)) out[k] = true;
  return out;
}

/**
 * ينظّف خريطة صلاحيات قادمة من الواجهة: يتجاهل المفاتيح غير المعروفة
 * ويحوّل القيم إلى قيم منطقية فقط.
 */
export function normalizePermissions(input: unknown): Permissions {
  const out: Permissions = {};
  if (input && typeof input === "object" && !Array.isArray(input)) {
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (!isPermissionKey(k)) continue;
      out[k] = v === true || v === "true" || v === 1;
    }
  }
  return out;
}

// ---------- التحقق الفعلي ----------
export type PermissionSubject = {
  role: "admin" | "user";
  permissions?: Permissions | null;
};

/**
 * هل يملك المستخدم الصلاحية المطلوبة؟
 * المدير (admin) يملك كل الصلاحيات دائمًا، بصرف النظر عن الخريطة المخزّنة.
 */
export function can(
  subject: PermissionSubject | null | undefined,
  key: PermissionKey,
): boolean {
  if (!subject) return false;
  if (subject.role === "admin") return true;
  return subject.permissions?.[key] === true;
}

// ---------- القوالب الجاهزة للصلاحيات ----------
/** شريك: يبيع ويدير العملاء بلا أي صلاحية إدارية أو مالية. */
export const DEFAULT_USER_PERMISSIONS: readonly PermissionKey[] = [
  "dashboard.view",
  "products.view",
  "sales.view",
  "sales.create",
  "sales.update",
  "clients.view",
  "clients.create",
  "reports.view",
  "inventory.view",
];

/** كاشير: إصدار الفواتير فقط. */
export const TEMPLATE_CASHIER: readonly PermissionKey[] = [
  "dashboard.view",
  "products.view",
  "sales.view",
  "sales.create",
  "clients.view",
  "clients.create",
];

/** محاسب: مالية كاملة بلا إدارة مستخدمين أو إعدادات. */
export const TEMPLATE_ACCOUNTANT: readonly PermissionKey[] = [
  "dashboard.view",
  "products.view",
  "sales.view",
  "sales.create",
  "sales.update",
  "sales.delete",
  "clients.view",
  "clients.create",
  "clients.update",
  "debts.view",
  "debts.create",
  "debts.delete",
  "expenses.view",
  "expenses.create",
  "expenses.delete",
  "returns.view",
  "returns.create",
  "returns.delete",
  "reports.view",
  "inventory.view",
  "sales.discount",
  "sales.credit",
  "finances.view_profit",
  "finances.view_cost",
];

/** اطّلاع فقط: لا تعديل ولا حذف. */
export const TEMPLATE_VIEW_ONLY: readonly PermissionKey[] = [
  "dashboard.view",
  "products.view",
  "sales.view",
  "clients.view",
  "reports.view",
  "inventory.view",
];

export const PERMISSION_TEMPLATES: readonly {
  key: string;
  label: string;
  hint: string;
  permissions: readonly PermissionKey[];
}[] = [
  {
    key: "default",
    label: "شريك (افتراضي)",
    hint: "بيع وإدارة عملاء وقراءة المخزون",
    permissions: DEFAULT_USER_PERMISSIONS,
  },
  {
    key: "cashier",
    label: "كاشير",
    hint: "إصدار الفواتير فقط",
    permissions: TEMPLATE_CASHIER,
  },
  {
    key: "accountant",
    label: "محاسب",
    hint: "مالية كاملة بلا إدارة مستخدمين أو إعدادات",
    permissions: TEMPLATE_ACCOUNTANT,
  },
  {
    key: "view",
    label: "اطّلاع فقط",
    hint: "لا يمكنه التعديل أو الحذف",
    permissions: TEMPLATE_VIEW_ONLY,
  },
  {
    key: "full",
    label: "كل الصلاحيات",
    hint: "مطابق لصلاحيات المدير",
    permissions: ALL_PERMISSION_KEYS,
  },
];

/** يحوّل مسار الصفحة إلى مفتاح المجموعة المقابل له. */
export function groupForPath(pathname: string): PermissionGroupKey | null {
  if (pathname === "/" || pathname === "") return "dashboard";
  if (pathname.startsWith("/products")) return "products";
  if (pathname.startsWith("/sales")) return "sales";
  if (pathname.startsWith("/clients")) return "clients";
  if (pathname.startsWith("/debts")) return "debts";
  if (pathname.startsWith("/expenses")) return "expenses";
  if (pathname.startsWith("/inventory")) return "inventory";
  if (pathname.startsWith("/returns")) return "returns";
  if (pathname.startsWith("/reports")) return "reports";
  if (pathname.startsWith("/users")) return "users";
  if (pathname.startsWith("/activity")) return "activity";
  if (pathname.startsWith("/settings")) return "settings";
  return null;
}


export function canAny(
  subject: PermissionSubject | null | undefined,
  keys: readonly PermissionKey[],
): boolean {
  return keys.some((k) => can(subject, k));
}

/** هل يملك كل الصلاحيات المطلوبة؟ */
export function canAll(
  subject: PermissionSubject | null | undefined,
  keys: readonly PermissionKey[],
): boolean {
  return keys.every((k) => can(subject, k));
}
