// نظام الثيمات — مصدر واحد لتعريف الثيمات وتطبيقها وحفظها.

export const THEME_STORAGE_KEY = "cc-theme";

export const THEMES = {
  /** الثيم الداكن الافتراضي (الأحمر الحالي) */
  dark: {
    id: "dark",
    label: "الوضع الداكن",
    short: "داكن",
    /** لون المعاينة في زر التبديل */
    swatch: ["#050505", "#ff2222", "#8a8a8a"],
  },
  /** الثيم الفسفوري الفاتح */
  phosphor: {
    id: "phosphor",
    label: "الثيم الفسفوري الفاتح",
    short: "فسفوري",
    swatch: ["#eef3f0", "#00c94b", "#ffcc00"],
  },
} as const;

export type ThemeId = keyof typeof THEMES;
export const THEME_IDS = Object.keys(THEMES) as ThemeId[];

/** قائمة الثيمات صالحة للتكرار في الواجهة. */
export const THEME_LIST = THEME_IDS.map((id) => THEMES[id]);

export const DEFAULT_THEME: ThemeId = "dark";

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === "string" && v in THEMES;
}

/** يقرأ الثيم المحفوظ، مع تجاهل أي قيمة تالفة. */
export function readStoredTheme(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(v) ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** يحفظ ويطبّق الثيم على <html> فورًا. */
export function applyTheme(theme: ThemeId) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === DEFAULT_THEME) root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // التخزين ممتلئ أو محظور — التطبيق في الصفحة يبقى فعالًا.
  }
}

export function toggleTheme(current: ThemeId): ThemeId {
  return current === "dark" ? "phosphor" : "dark";
}
