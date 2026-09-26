"use client";

import { Moon, Sun } from "lucide-react";
import { THEMES } from "@/lib/theme";
import { useTheme } from "./ThemeProvider";

/**
 * زر تبديل الثيم: ينتقل فورًا بين الداكن والفسفوري الفاتح،
 * ويحفظ الاختيار في LocalStorage ليبقى بعد إعادة التحميل.
 */
export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggle } = useTheme();
  const isLight = theme === "phosphor";
  const next = THEMES[isLight ? "dark" : "phosphor"];

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`التبديل إلى ${next.label}`}
      title={`التبديل إلى ${next.label}`}
      data-theme-toggle=""
      className="icon-btn"
    >
      {/* أيقينة قمر للفاتح (سيعود للداكن)، شمس للداكن (سيصبح فسفوريًا) */}
      {isLight ? <Moon size={15} aria-hidden /> : <Sun size={15} aria-hidden />}
      {!compact && (
        <span className="hidden text-[12px] font-extrabold lg:inline">
          {THEMES[theme].short}
        </span>
      )}
    </button>
  );
}
