/**
 * نظام تعدد اللغات (i18n) — عربي / إنجليزي.
 *
 * بنية: قاموس مسطّح بمفاتيح نصية + دالة t() آمنة:
 * إن لم يوجد المفتاح يُعاد النص العربي (لا يظهر "undefined" أبدًا).
 */

export const LANG_STORAGE_KEY = "cc-lang";
export const DEFAULT_LANG = "ar";

export const LANGS = {
  ar: { id: "ar", label: "العربية", short: "ع", dir: "rtl" },
  en: { id: "en", label: "English", short: "EN", dir: "ltr" },
} as const;

export type Lang = keyof typeof LANGS;

/** القاموس: المفتاح = نفس النص العربي (يمثّل النسخة العربية تلقائيًا). */
const DICT = {
  ar: {} as Record<string, string>,
  en: {
    // ---------- التنقل ----------
    "لوحة التحكم": "Dashboard",
    "الأصناف والمخزون": "Products & Stock",
    "الفواتير": "Invoices",
    "فاتورة جديدة": "New Invoice",
    "العملاء": "Clients",
    "الديون والتحصيل": "Debts & Collection",
    "المصاريف": "Expenses",
    "حركة المخزون": "Stock Movements",
    "المرتجعات والاستبدال": "Returns & Exchange",
    "التقارير": "Reports",
    "المستخدمون": "Users",
    "سجل النشاط": "Activity Log",
    "الإعدادات والنسخ": "Settings & Backup",

    // ---------- عام ----------
    "دخول": "Sign in",
    "تسجيل الدخول": "Sign in",
    "تسجيل الخروج": "Sign out",
    "إلغاء": "Cancel",
    "حفظ": "Save",
    "حفظ التعديلات": "Save changes",
    "إضافة": "Add",
    "تعديل": "Edit",
    "حذف": "Delete",
    "عرض": "View",
    "بحث": "Search",
    "تصفية": "Filter",
    "تأكيد": "Confirm",
    "تراجع": "Back",
    "إغلاق": "Close",
    "جارٍ التحميل…": "Loading…",
    "لا توجد بيانات": "No data",
    "اسم المستخدم": "Username",
    "كلمة المرور": "Password",
    "مثال: admin": "e.g. admin",
    "إظهار كلمة المرور": "Show password",
    "إخفاء كلمة المرور": "Hide password",
    "العملة": "Currency",
    "الثيم": "Theme",
    "اللغة": "Language",
    "صغير": "Small",
    "متوسط": "Medium",
    "كبير": "Large",

    // ---------- التنبيهات ----------
    "تنبيه الذمم": "Debts alert",
    "تنبيه نقص المخزون": "Low stock alert",
    "تحذير": "Warning",
    "خطأ": "Error",
    "تم الحفظ بنجاح": "Saved successfully",
    "حدث خطأ غير متوقع": "An unexpected error occurred",
    "إعادة المحاولة": "Retry",

    // ---------- الذمم والتقسيط ----------
    "خطة التقسيط والذمم": "Installment Plan",
    "المبلغ المتبقي": "Remaining amount",
    "إجمالي المجدول": "Total scheduled",
    "إجمالي المجدول ": "Total scheduled ",
    "المبلغ": "Amount",
    "تاريخ الاستحقاق": "Due date",
    "إضافة دفعة": "Add installment",
    "حفظ خطة التقسيط": "Save installment plan",
    "الخطة المحفوظة": "Saved plan",
    "تعليم كمسدّدة": "Mark as paid",
    "مسدّدة": "Paid",
    "مطابق تمامًا": "Fully matched",
    "باقي غير مجدول": "Unscheduled",
    "تجاوز المتبقي": "Exceeds remaining",

    // ---------- المستخدمون ----------
    "الصلاحية": "Role",
    "الصلاحيات": "Permissions",
    "كل الصلاحيات": "All permissions",
    "مدير (ماستر)": "Admin (master)",
    "مستخدم (شريك)": "User (partner)",
    "إنشاء مستخدم جديد": "Create new user",
    "التحكم بالصلاحيات": "Manage permissions",
    "تعيين كلمة مرور": "Set password",
    "قالب جاهز": "Preset",
    "إعداد مخصّص": "Custom",
  },
};

export type TKey = keyof typeof DICT.en;

export function isLang(v: unknown): v is Lang {
  return typeof v === "string" && v in LANGS;
}

/** يقرأ اللغة المحفوظة مع تجاهل القيم التالفة. */
export function readStoredLang(): Lang {
  if (typeof window === "undefined") return DEFAULT_LANG;
  try {
    const v = window.localStorage.getItem(LANG_STORAGE_KEY);
    return isLang(v) ? v : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

/** يحفظ اللغة ويحدّث اتجاه الصفحة وlang فورًا. */
export function applyLang(lang: Lang) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("lang", lang);
  root.setAttribute("dir", LANGS[lang].dir);
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // التخزين محظور — يبقى التغيير ساريًا في الصفحة الحالية.
  }
}

/** ترجمة آمنة: ترجع النص العربي الأصلي عند غياب المفتاح. */
export function translate(lang: Lang, text: string): string {
  if (lang === DEFAULT_LANG) return text;
  const table = DICT[lang] as Record<string, string>;
  return table[text] ?? text;
}

export function dirFor(lang: Lang): "rtl" | "ltr" {
  return LANGS[lang].dir;
}
