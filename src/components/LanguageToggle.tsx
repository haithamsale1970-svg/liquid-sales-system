"use client";

import { Languages } from "lucide-react";
import { useLang } from "./LanguageProvider";
import { LANGS } from "@/lib/i18n";

/** زر تبديل اللغة (عربي ⇄ English) — يحفظ الاختيار ويبدّل اتجاه الصفحة. */
export default function LanguageToggle() {
  const { lang, toggle } = useLang();
  const next = lang === "ar" ? "en" : "ar";

  return (
    <button
      type="button"
      onClick={toggle}
      className="icon-btn"
      data-lang-toggle=""
      aria-label={next === "en" ? "Switch to English" : "التبديل إلى العربية"}
      title={next === "en" ? "Switch to English" : "التبديل إلى العربية"}
    >
      <Languages size={15} aria-hidden />
      <span className="hidden text-[12px] font-extrabold lg:inline">
        {LANGS[lang].short}
      </span>
    </button>
  );
}
