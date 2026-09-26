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

/**
 * القاموس الإنجليزي الشامل.
 * المفتاح = النص العربي كما هو موجود في الكود حرفيًا.
 * أي نص غير مترجم هنا يعود عربيًا تلقائيًا (لا يظهر "undefined" أبدًا).
 */
const EN: Record<string, string> = {
  // ================= التنقل =================
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
  "تفاصيل الفاتورة": "Invoice details",

  // ================= أزرار عامة =================
  "دخول": "Sign in",
  "تسجيل الدخول": "Sign in",
  "تسجيل الخروج": "Sign out",
  "إلغاء": "Cancel",
  "تراجع": "Back",
  "تأكيد": "Confirm",
  "حفظ": "Save",
  "حفظ التعديلات": "Save changes",
  "إضافة": "Add",
  "تعديل": "Edit",
  "حذف": "Delete",
  "عرض": "View",
  "بحث": "Search",
  "تصفية": "Filter",
  "مسح": "Clear",
  "إغلاق": "Close",
  "فتح القائمة": "Open menu",
  "إغلاق القائمة": "Close menu",
  "تحديث": "Refresh",
  "طباعة": "Print",
  "تصدير": "Export",
  "أرشفة": "Archive",
  "استعادة": "Restore",
  "الأرشيف": "Archive",
  "تطبيق": "Apply",
  "اختيار": "Select",
  "الكل": "All",
  "إجمالي": "Total",
  "تفاصيل": "Details",
  "إجراءات": "Actions",
  "لا توجد بيانات": "No data",
  "جارٍ التحميل…": "Loading…",
  "منذ": "since",

  // ================= رسائل =================
  "تم الحفظ بنجاح": "Saved successfully",
  "تم الحفظ": "Saved",
  "تم التحديث": "Updated",
  "تم الحذف": "Deleted",
  "تم حفظ خطة التقسيط": "Installment plan saved",
  "تم حفظ الإعدادات": "Settings saved",
  "تعذر الحفظ": "Could not save",
  "تعذر التحديث": "Could not update",
  "تعذر الإنشاء": "Could not create",
  "تعذر الحذف": "Could not delete",
  "تعذر التحميل": "Could not load",
  "تعذر تسجيل الدخول": "Could not sign in",
  "حدث خطأ غير متوقع": "An unexpected error occurred",
  "إعادة المحاولة": "Retry",
  "العودة للرئيسية": "Back to home",
  "تحذير": "Warning",
  "خطأ": "Error",
  "تنبيه الذمم": "Debts alert",
  "تنبيه نقص المخزون": "Low stock alert",
  "لا يوجد مبلغ متبقي لتقسيطه على هذه الفاتورة.": "No remaining amount to split on this invoice.",

  // ================= مصطلحات عامة =================
  "الأصناف": "Items",
  "الرقم ": "No. ",
  "الرقم": "Number",
  "ملاحظة (اختياري)": "Note (optional)",
  "Google Maps Location": "Google Maps location",
  "Distribution Map": "Distribution map",
  "الكمية المتبقية ": "Remaining qty ",
  "المنتجات": "Products",
  "الصنف": "Item",
  "العميل": "Client",
  "الفاتورة": "Invoice",
  "الحركة": "Movement",
  "الحركات": "Movements",
  "المستخدم": "User",
  "الموظف": "Employee",
  "المنفّذ": "Performed by",
  "البائع": "Seller",
  "القسم": "Section",
  "القسم / الصفحة": "Section / Page",
  "التصنيف": "Category",
  "السعر": "Price",
  "الكمية": "Quantity",
  "الاسم": "Name",
  "الوصف": "Description",
  "الملاحظات": "Notes",
  "الملاحظة": "Note",
  "العنوان": "Address",
  "الهاتف": "Phone",
  "التاريخ": "Date",
  "الحالة": "Status",
  "النوع": "Type",
  "طريقة الدفع": "Payment method",
  "الطريقة": "Method",
  "السبب": "Reason",
  "المرجع": "Reference",
  "وحدات مباعة": "Units sold",
  "الرصيد (دين)": "Balance (debt)",
  "الرصيد بعد": "Balance after",
  "المدفوع": "Paid",
  "المتبقي": "Remaining",
  "المتبقي (دين)": "Remaining (debt)",
  "الدفع": "Payment",
  "الدفعات": "Installments",
  "عند": "At",
  "العميل ": "Client ",
  "المستخدم ": "User ",
  "المنتجات ": "Products ",

  // ================= عناوين الجداول =================
  "الاسم *": "Name *",
  "اسم الدخول": "Username",
  "اسم الدخول *": "Username *",
  "الاسم المعروض": "Display name",
  "الاسم المعروض *": "Display name *",
  "الصلاحية": "Role",
  "الصلاحيات": "Permissions",
  "كل الصلاحيات": "All permissions",
  "الباركود": "Barcode",
  "التكلفة": "Cost",
  "الربح": "Profit",
  "الإيراد": "Revenue",
  "رقم الفاتورة": "Invoice #",
  "التوصيل": "Delivery",
  "الرصيد": "Balance",
  "نوع الحركة": "Movement type",
  "صافي الحركة": "Net movement",
  "قطع عادت للمخزون": "Items returned to stock",
  "قطع بديلة خرجت": "Replacement items issued",
  "عدد الحركات المسجلة": "Recorded movements",
  "أضافه": "Added by",
  "الفرق": "Difference",
  "قيمة التعديل (+ إضافة / − خصم)": "Adjustment (+ add / − subtract)",
  "الكمية بالمخزون": "Qty in stock",
  "وحدات بالمخزون": "Units in stock",
  "الكامل": "Full",

  // ================= المنتج =================
  "اسم المنتج *": "Product name *",
  "سعر البيع *": "Selling price *",
  "سعر التكلفة (لحساب الربح)": "Cost price (for profit)",
  "المخزون (اختياري)": "Stock (optional)",
  "حد تنبيه نقص المخزون": "Low-stock threshold",
  "تكلفة الخيار": "Option cost",
  "تنبيه نقص (اختياري)": "Low stock (optional)",
  "المقاس / النيكوتين": "Size / Nicotine",
  "الحجم والنيكوتين *": "Size / Nicotine *",
  "سعر الأفراد *": "Retail price *",
  "سعر الجملة (اختياري)": "Wholesale price (optional)",
  "سعر الصرف: جنيه لكل دينار (EGP)": "Rate: EGP per dinar",
  "سعر الصرف: دولار لكل دينار (USD)": "Rate: USD per dinar",
  "إضافة منتج": "Add product",
  "تعديل منتج": "Edit product",
  "إضافة صنف جديد": "Add new item",
  "إضافة منتج جديد": "Add new product",
  "إضافة عميل جديد": "Add new client",
  "تعديل عميل": "Edit client",
  "التوفّر": "Availability",
  "متاح": "Available",
  "نفد المخزون": "Out of stock",
  "مخزون منخفض": "Low stock",
  "متبقٍ": "Left",
  "نفد": "Out",
  "حد التنبيه": "Threshold",
  "أضف صنفًا واحدًا على الأقل للفاتورة": "Add at least one item to the invoice",
  "لم يتم أرشفة أي منتج بعد": "No archived products yet",
  "أضف أول منتج لبدء البيع وإصدار الفواتير": "Add your first product to start selling",
  "رقم هاتف ثانٍ (اختياري)": "Second phone (optional)",

  // ================= الفواتير =================
  "عميل جديد": "New client",
  "الكمية المتبقية": "Remaining quantity",
  "إضافة إلى الفاتورة": "Add to invoice",
  "الخصم على الفاتورة": "Invoice discount",
  "الخصم": "Discount",
  "الإجمالي النهائي": "Final total",
  "الربح المتوقع": "Expected profit",
  "المتبقي على العميل": "Remaining on client",
  "حفظ الفاتورة وخصم المخزون": "Save invoice & deduct stock",
  "مرتجع / استبدال": "Return / Exchange",
  "إلغاء الفاتورة": "Cancel invoice",
  "طباعة / حفظ PDF": "Print / Save PDF",
  "طباعة حرارية (80mm)": "Thermal print (80mm)",
  "ملاحظات الفاتورة": "Invoice notes",
  "سبب الإرجاع أو الاستبدال *": "Return/exchange reason *",
  "سبب مخصص *": "Custom reason *",
  "طريقة الاسترداد / فرق الاستبدال": "Refund method / exchange difference",
  "اختر سببًا من القائمة": "Select a reason from the list",
  "تسجيل المرتجع": "Record return",
  "تم تسجيل المرتجع/الاستبدال وتحديث المخزون والحساب": "Return recorded; stock and balance updated",
  "تم إلغاء الفاتورة واسترجاع الكميات للمخزون": "Invoice cancelled; stock restored",
  "بقيت خطوة: اختيار العميل لإتمام الحفظ": "One step left: pick a client to save",
  "العميل *": "Client *",

  // ================= الذمم =================
  "أقدم رصيد مفتوح": "Oldest open balance",
  "الفواتير غير المسدّدة": "Unpaid invoices",
  "عملاء مدينون": "Clients with debt",
  "فواتير مفتوحة": "Open invoices",
  "فواتير الشهر": "This month’s invoices",
  "آخر فاتورة": "Last invoice",
  "آخر طلب": "Last order",
  "إجمالي مشترياته": "Total purchases",
  "إجمالي المشتريات": "Total purchases",
  "عدد الطلبات": "Orders count",
  "عدد الفواتير": "Invoices count",
  "مبلغ الديون": "Debt amount",
  "دفعة": "Installment",
  "الدفعة المقدمة": "Down payment",
  "تاريخ الاستحقاق": "Due date",
  "إضافة دفعة": "Add installment",
  "حفظ خطة التقسيط": "Save installment plan",
  "الخطة المحفوظة": "Saved plan",
  "تعليم كمسدّدة": "Mark as paid",
  "مسدّدة": "Paid",
  "مطابق تمامًا": "Fully matched",
  "باقي غير مجدول": "Unscheduled",
  "تجاوز المتبقي": "Exceeds remaining",
  "خطة التقسيط والذمم": "Installment plan",
  "المبلغ المتبقي": "Remaining amount",
  "إجمالي المجدول": "Total scheduled",
  "مستحقة اليوم": "Due today",
  "غدًا": "Tomorrow",
  "متأخرة": "Overdue",

  // ================= المخزون والمصاريف والمرتجعات =================
  "إجمالي الكميات الداخلة": "Total items in",
  "إجمالي الكميات الخارجة": "Total items out",
  "إضافة مصروف": "Add expense",
  "تعديل المصروف": "Edit expense",
  "عدد المصاريف": "Expenses count",
  "قيمة المصروف": "Expense amount",
  "السبب / ملاحظة": "Reason / note",
  "حذف المصروف": "Delete expense",
  "إضافة مرتجع": "Add return",
  "عدد المرتجعات": "Returns count",

  // ================= التقارير =================
  "إجمالي المبيعات": "Total sales",
  "صافي الربح": "Net profit",
  "متوسط الفاتورة": "Average invoice",
  "أعلى المنتجات": "Top products",
  "أعلى العملاء": "Top clients",
  "حسب المنتج": "By product",
  "حسب العميل": "By client",
  "حسب الموظف": "By employee",
  "حسب طريقة الدفع": "By payment method",
  "مبيعات الموظفين": "Employee sales",
  "تحصيل الذمم": "Debt collection",
  "إجمالي الخصومات": "Total discounts",
  "المستحق (آجل)": "Receivable (credit)",
  "من تاريخ": "From date",
  "إلى تاريخ": "To date",

  // ================= المصادقة =================
  "اسم المستخدم": "Username",
  "كلمة المرور": "Password",
  "كلمة المرور *": "Password *",
  "مثال: admin": "e.g. admin",
  "إظهار كلمة المرور": "Show password",
  "إخفاء كلمة المرور": "Hide password",
  "الجديدة (6 أحرف+)": "New (6+ chars)",
  "تأكيد الجديدة": "Confirm new",
  "كلمة المرور الجديدة": "New password",
  "كلمة المرور الحالية": "Current password",
  "تغيير كلمة المرور": "Change password",
  "ابدأ الآن": "Get started",
  "رجوع لشاشة الترحيب": "Back to welcome",
  "اضغط للمتابعة إلى تسجيل الدخول": "Click to continue to sign in",

  // ================= المستخدمون =================
  "مدير (ماستر)": "Admin (master)",
  "مستخدم (شريك)": "User (partner)",
  "مدير النظام (ماستر)": "System admin (master)",
  "شريك": "Partner",
  "إنشاء مستخدم جديد": "Create new user",
  "إنشاء الحساب": "Create account",
  "التحكم بالصلاحيات": "Manage permissions",
  "تعيين كلمة مرور": "Set password",
  "كلمة مرور جديدة": "New password",
  "قالب جاهز": "Preset",
  "إعداد مخصّص": "Custom",
  "الصلاحيات الممنوحة": "Granted permissions",
  "أنت": "You",
  "لا يمكن تغيير صلاحيتك بنفسك": "You cannot change your own role",

  // ================= الإعدادات =================
  "الإعدادات": "Settings",
  "العملة الافتراضية للنظام": "Default system currency",
  "ثيم النظام": "System theme",
  "لغة النظام": "System language",
  "النسخ الاحتياطي": "Backup",
  "اسم التصنيف المخصص": "Custom reason",
  "من اليمين إلى اليسار": "Right to left",
  "تم حفظ إعدادات العملات والتوصيل والصلاحيات": "Currency, delivery and section settings saved",
  "الثيم الفسفوري الفاتح": "Neon Phosphor Light",
  "الوضع الداكن": "Dark mode",
  "داكن": "Dark",
  "فسفوري": "Phosphor",
  "عربي": "Arabic",
  "إنجليزي": "English",
  "العربية": "Arabic",
  "English": "English",
  "الثيم": "Theme",
  "اللغة": "Language",
  "العملة": "Currency",
  "تبديل الثيم": "Toggle theme",
  "تبديل اللغة": "Toggle language",
  "عملة العرض — التحويل فوري": "Display currency — instant conversion",

  // ================= الحالات =================
  "مكتملة": "Completed",
  "ملغاة": "Cancelled",
  "مدفوعة": "Paid",
  "غير مدفوعة": "Unpaid",
  "جزئي": "Partial",
  "نقدًا": "Cash",
  "بالآجل": "Credit",
  "فردي": "Individual",
  "محل": "Shop",
  "شركة": "Company",
  "خروج": "Out",
  "داخل": "In",
  "نقص": "Deduction",

  // ================= لا صلاحية =================
  "لم يتم منحك أي صلاحية بعد": "No permissions have been granted to you yet",
  "حسابك مسجّل ونشط": "Your account is active",
  "راجع مدير النظام": "Contact your administrator",
  "لا تملك صلاحية فتح هذه الصفحة": "You don’t have access to this page",
  "يمكنك متابعة العمل من إحدى الصفحات المسموحة لك": "You can continue from one of your permitted pages",
  "الذهاب إلى الصفحة المسموحة": "Go to my page",
  "إعادة تحميل الجلسة": "Reload session",
};

export type TKey = keyof typeof EN;

/** اللغة النشطة حاليًا (يحدّثها applyLang عند التبديل). */
let currentLang: Lang = DEFAULT_LANG;

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
  currentLang = lang;
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

/**
 * دالة ترجمة عامة تُستدعى مباشرة داخل أي مكوّن دون Hook.
 * LanguageProvider يُعيد تركيب الشجرة عند تغيّر اللغة فتُحدَّث كل النصوص.
 */
export function t(text: string): string {
  if (!text || currentLang === DEFAULT_LANG) return text;
  return EN[text] ?? text;
}

/** ترجمة آمنة: ترجع النص العربي الأصلي عند غياب المفتاح. */
export function translate(lang: Lang, text: string): string {
  if (lang === DEFAULT_LANG || !text) return text;
  return EN[text] ?? text;
}

/** هل هذا النص مترجم؟ (مفيد لاختبار الاكتمال) */
export function isTranslated(text: string): boolean {
  return Object.prototype.hasOwnProperty.call(EN, text);
}

/** كل مفاتيح القاموس (للاختبار والتوثيق). */
export const TRANSLATION_KEYS = Object.keys(EN);

export function dirFor(lang: Lang): "rtl" | "ltr" {
  return LANGS[lang].dir;
}
