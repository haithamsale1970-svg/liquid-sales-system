// ============================================================
// نظام العملات الثابت — Cloud Culture
// العملات المدعومة حصريًا: JOD (أساس) / USD / EGP
// التخزين دائمًا بالدينار الأردني JOD، والعرض يتحوّل فوريًا.
// ============================================================

export const CURRENCIES = {
  JOD: { code: "JOD", label: "دينار أردني", short: "د.أ", symbol: "JOD" },
  USD: { code: "USD", label: "دولار أمريكي", short: "$", symbol: "USD" },
  EGP: { code: "EGP", label: "جنيه مصري", short: "ج.م", symbol: "EGP" },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;
export const CURRENCY_CODES: CurrencyCode[] = ["JOD", "USD", "EGP"];

export function isCurrencyCode(v: unknown): v is CurrencyCode {
  return v === "JOD" || v === "USD" || v === "EGP";
}

// قيمة الدينار الواحد (JOD) بوحدات كل عملة — تُعدَّل من لوحة الأدمن.
export const DEFAULT_RATES_PER_JOD: Record<CurrencyCode, number> = {
  JOD: 1,
  USD: 1.41,
  EGP: 67.5,
};

// أسعار التوصيل الثابتة (بالدينار) — تُعدَّل من لوحة الأدمن فقط.
export const DEFAULT_SHIPPING = { internal: 1.5, external: 2 } as const;

export type AppSettings = {
  defaultCurrency: CurrencyCode;
  rateUSD: number; // كم دولار للدينار الواحد
  rateEGP: number; // كم جنيه للدينار الواحد
  shippingInternal: number;
  shippingExternal: number;
  showReportsForUsers: boolean;
  showClientsForUsers: boolean;
  showProductsForUsers: boolean;
  /** صلاحية الموظفين (abood / hasan) في إضافة العملاء وتصحيح أرقام هواتفهم. */
  allowUsersEditClients: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  defaultCurrency: "JOD",
  rateUSD: DEFAULT_RATES_PER_JOD.USD,
  rateEGP: DEFAULT_RATES_PER_JOD.EGP,
  shippingInternal: DEFAULT_SHIPPING.internal,
  shippingExternal: DEFAULT_SHIPPING.external,
  showReportsForUsers: true,
  showClientsForUsers: true,
  showProductsForUsers: true,
  allowUsersEditClients: false,
};

export function ratesFromSettings(s: AppSettings): Record<CurrencyCode, number> {
  return {
    JOD: 1,
    USD: s.rateUSD > 0 ? s.rateUSD : DEFAULT_RATES_PER_JOD.USD,
    EGP: s.rateEGP > 0 ? s.rateEGP : DEFAULT_RATES_PER_JOD.EGP,
  };
}

/** تحويل مبلغ مخزّن بالدينار إلى عملة العرض. */
export function convertFromJOD(amountJOD: number, to: CurrencyCode, rates?: Record<CurrencyCode, number>): number {
  const r = (rates ?? DEFAULT_RATES_PER_JOD)[to] ?? 1;
  return (Number(amountJOD) || 0) * r;
}

/** تحويل مبلغ بعملة العرض إلى الدينار (للحفظ). */
export function convertToJOD(amount: number, from: CurrencyCode, rates?: Record<CurrencyCode, number>): number {
  const r = (rates ?? DEFAULT_RATES_PER_JOD)[from] ?? 1;
  if (!r) return Number(amount) || 0;
  return (Number(amount) || 0) / r;
}

const nf = new Intl.NumberFormat("ar-EG-u-nu-latn", { maximumFractionDigits: 2 });

export function currencySuffix(code: CurrencyCode): string {
  if (code === "JOD") return "د.أ";
  if (code === "USD") return "$";
  return "ج.م";
}

/** تنسيق مبلغ (مخزّن JOD) بعملة العرض المختارة. */
export function formatMoneyJOD(
  amountJOD: number,
  code: CurrencyCode = "JOD",
  rates?: Record<CurrencyCode, number>,
): string {
  const v = convertFromJOD(amountJOD, code, rates);
  return `${nf.format(v || 0)} ${currencySuffix(code)}`;
}

// ---------- Currency preference (client) ----------
const LS_KEY = "cc_currency";

export function getPreferredCurrency(fallback: CurrencyCode = "JOD"): CurrencyCode {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(LS_KEY);
    if (isCurrencyCode(v)) return v;
  } catch {}
  return fallback;
}

export function setPreferredCurrency(code: CurrencyCode) {
  try {
    window.localStorage.setItem(LS_KEY, code);
    window.dispatchEvent(new CustomEvent("cc:currency", { detail: code }));
  } catch {}
}
